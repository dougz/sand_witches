#!/usr/bin/python3

import argparse
import os
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("--debug", action="store_true")
options = parser.parse_args()

with zipfile.ZipFile("sand_witches.zip", mode="w") as z:
  with z.open("puzzle.html", "w") as f_out:
    with open("sand_witches.html", "rb") as f_in:

      html = f_in.read()

      if options.debug:
        head = ('<link rel=stylesheet href="/sanddebug/sand_witches.css" />'
                '<script src="/closure/goog/base.js"></script>'
                '<script src="/sanddebug/sand_witches.js"></script>')
      else:
        head = ('<link rel=stylesheet href="sand_witches.css" />'
                '<script src="sand_witches-compiled.js"></script>')

      html = html.replace(b"@HEAD@", head.encode("utf-8"))

      f_out.write(html)

  with z.open("solution.html", "w") as f_out:
    with open("solution.html", "rb") as f_in:
      f_out.write(f_in.read())

  with z.open("metadata.yaml", "w") as f_out:
    with open("metadata.yaml", "rb") as f_in:
      f_out.write(f_in.read())

  z.write("static_puzzle.html")
  z.write("static_clue_checker.js")

  if not options.debug:
    with z.open("sand_witches.css", "w") as f_out:
      with open("sand_witches.css", "rb") as f_in:
        f_out.write(f_in.read())

    with z.open("sand_witches-compiled.js", "w") as f_out:
      with open("sand_witches-compiled.js", "rb") as f_in:
        f_out.write(f_in.read())

