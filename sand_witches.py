#!/usr/bin/python3

import argparse
import asyncio
import collections
import itertools
import json
import os
import random
import re
import time
import unicodedata

import http.client
import tornado.web

import scrum


def canonicalize_answer(text):
  text = unicodedata.normalize("NFD", text.upper())
  out = []
  for k in text:
    cat = unicodedata.category(k)
    # Letters only.
    if cat[:1] == "L":
      out.append(k)
  return "".join(out)


class Clue:
  def __init__(self, clue, answer):
    self.clue = clue
    self.display_answer = answer
    self.answer = canonicalize_answer(answer)
    self.blanks = re.sub("[A-Z]", "_", answer)

    print(self.display_answer, self.blanks)


class GameState:
  BY_TEAM = {}

  @classmethod
  def set_globals(cls, options, clues):
    cls.options = options
    cls.clues = clues

  @classmethod
  def get_for_team(cls, team):
    if team not in cls.BY_TEAM:
      cls.BY_TEAM[team] = cls(team)
    return cls.BY_TEAM[team]

  def __init__(self, team):
    self.team = team
    self.sessions = set()
    self.wid_sessions = {}
    self.running = False
    self.cond = asyncio.Condition()

    self.solved = set()
    self.widq = collections.deque()
    self.wids = {}

    if self.options.min_players is not None:
      self.min_size = self.options.min_players
    else:
      self.min_size = max(2, (team.size + 1) // 4)
      if self.min_size > 20:
        self.min_size = 20

  async def on_wait(self, session, wid):
    now = time.time()
    wid = f"w{wid}"
    self.widq.append((wid, now))

    count = self.wids[wid] = self.wids.get(wid, 0) + 1
    if count == 1:
      # a new wid has been issued
      async with self.cond:
        self.cond.notify_all()

    self.wid_sessions[wid] = session

    async with self.cond:
      if session not in self.sessions:
        self.sessions.add(session)
        self.cond.notify_all()


  async def run_game(self):
    while True:
      count = len(self.sessions)
      if count >= self.min_size: break
      text = (
        f"You need {self.min_size} players to start the game.<br>"
        f"{count} {'is' if count == 1 else 'are'} currently waiting.")
      msg = {"method": "show_message", "text": text}
      await self.team.send_messages([msg], sticky=1)
      async with self.cond:
        await self.cond.wait()

    skip_threshold = min(self.min_size, 3)

    for clue in itertools.cycle(self.clues):
      self.current_clue = clue
      self.current_skips = set()

      if clue not in self.solved:
        d = {"method": "show_clue",
             "clue": clue.clue,
             "blanks": clue.blanks}
        await self.team.send_messages([d], sticky=1)

        async with self.cond:
          while (clue not in self.solved and
                 len(self.current_skips) < skip_threshold):
            await self.cond.wait()
            print(skip_threshold, self.current_skips)

      if clue in self.solved:
        d = {"method": "show_answer",
             "clue": clue.clue,
             "answer": clue.display_answer}
        await self.team.send_messages([d], sticky=1)
        await asyncio.sleep(1.5)

      if len(self.solved) == len(self.clues): break

    all_clues = [[c.clue, c.display_answer] for c in self.clues]
    d = {"method": "show_all", "all": all_clues}
    await self.team.send_messages([d], sticky=1)


  async def send_chat(self, text):
    d = {"method": "add_chat", "text": text}
    await self.team.send_messages([d])

  async def try_answer(self, answer):
    async with self.cond:
      if (self.current_clue not in self.solved and
          answer == self.current_clue.answer):
        self.solved.add(self.current_clue)
        self.cond.notify_all()

  async def vote_skip(self, session):
    async with self.cond:
      if session not in self.current_skips:
        self.current_skips.add(session)
        self.cond.notify_all()
        return True


class SandWitchesApp(scrum.ScrumApp):
  async def on_wait(self, team, session, wid):
    gs = GameState.get_for_team(team)

    if not gs.running:
      gs.running = True
      self.add_callback(gs.run_game)

    await gs.on_wait(session, wid)


class SubmitHandler(tornado.web.RequestHandler):
  def prepare(self):
    self.args = json.loads(self.request.body)

  async def post(self):
    scrum_app = self.application.settings["scrum_app"]
    team, session = await scrum_app.check_cookie(self)
    gs = GameState.get_for_team(team)

    submission = self.args["answer"]
    answer = canonicalize_answer(submission)
    who = self.args["who"].strip()
    if not who: who = "anonymous"
    print(f"{team}: {who} submitted {answer}")

    await gs.send_chat(f"{who} guessed \"{submission}\"")
    await gs.try_answer(answer)

    self.set_status(http.client.NO_CONTENT.value)

class SkipHandler(tornado.web.RequestHandler):
  def prepare(self):
    self.args = json.loads(self.request.body)

  async def post(self):
    scrum_app = self.application.settings["scrum_app"]
    team, session = await scrum_app.check_cookie(self)
    gs = GameState.get_for_team(team)

    who = self.args["who"].strip()
    if not who: who = "anonymous"

    if await gs.vote_skip(session):
      await gs.send_chat(f"{who} votes to skip")

    self.set_status(http.client.NO_CONTENT.value)


class DebugHandler(tornado.web.RequestHandler):
  def get(self, fn):
    if fn.endswith(".css"):
      self.set_header("Content-Type", "text/css")
    elif fn.endswith(".js"):
      self.set_header("Content-Type", "application/javascript")
    with open(fn) as f:
      self.write(f.read())


def make_app(options):
  clues = [Clue(*c) for c in (
    ("Injure a package delivery service", "HARM UPS"),
    ("Amount you have to put up to get on a horse", "STAKE TO RIDE"),
    ("Made the number before two <i>reallllly</i> long", "STRETCHED ONE"),
    ("Got a steal on better plot of real estate using Korean currency", "WON DEAL: NICER LAND"),
    ("The period in your life where you are taking care of someone (or working at a bar)",
     "TENDING YEARS"),
    ("Declare that it's Mr. Offerman's fault", "BLAME NICK"),
    ("A military meal for the entire rodent lair", "MOUSE DEN RATION"),
    ("\"Hold up, boy!  I am fixing my shoelaces, which seem to have come undone.\"",
     "WAIT LAD, TYING"),
    ("Trips to and from the end of the pool where you don't really mean it", "IRONIC LAPS"),
    ("Command to Kristof's reindeer: \"Make these corncobs warmer!\"",
     "HEAT EARS, SVEN"),
    ("Solo's attempt to get laughs", "HAN'S COMEDY"),
    ("Overheard at the Taj Mahal: \"That's an almond, not a pistachio!\"", "AGRA NUT ID"),
    ("What you need to sport on your face and chin before heading to your job in the coal shafts",
     "MINE BEARD"))]

  assert len(clues) == 13

  GameState.set_globals(options, clues)

  handlers = [
    (r"/sandsubmit", SubmitHandler),
    (r"/sandskip", SkipHandler),
  ]
  if options.debug:
    handlers.append((r"/sanddebug/(\S+)", DebugHandler))
  return handlers


def main():
  parser = argparse.ArgumentParser(description="Run the sand_witches puzzle.")
  parser.add_argument("--debug", action="store_true",
                      help="Run in debug mode.")
  parser.add_argument("--assets_json", default=None,
                      help="JSON file for image assets")
  parser.add_argument("-c", "--cookie_secret",
                      default="snellen2020",
                      help="Secret used to create session cookies.")
  parser.add_argument("--listen_port", type=int, default=2006,
                      help="Port requests from frontend.")
  parser.add_argument("--wait_url", default="sandwait",
                      help="Path for wait requests from frontend.")
  parser.add_argument("--main_server_port", type=int, default=2020,
                      help="Port to use for requests to main server.")
  parser.add_argument("--min_players", type=int, default=None,
                      help="Number of players needed to start game.")

  options = parser.parse_args()

  app = SandWitchesApp(options, make_app(options))
  app.start()


if __name__ == "__main__":
  main()

