goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.dom.TagName');
goog.require('goog.events');
goog.require('goog.events.KeyCodes');
goog.require('goog.net.XhrIo');
goog.require("goog.json.Serializer");

class SandWitchesDispatcher {
    constructor() {
	this.methods = {
	    "add_chat": goog.bind(this.add_chat, this),
	    "show_message": goog.bind(this.show_message, this),
	    "show_clue": goog.bind(this.show_clue, this),
	    "show_answer": goog.bind(this.show_answer, this),
	    "show_all": goog.bind(this.show_all, this),
            "players": goog.bind(this.players, this),
	}
    }

    /** @param{Message} msg */
    dispatch(msg) {
	this.methods[msg.method](msg);
    }

    /** @param{Message} msg */
    players(msg) {
        var el = goog.dom.getElement("players");
        el.innerHTML = "<b>Players:</b> " + msg.players;
    }

    /** @param{Message} msg */
    show_message(msg) {
        sand_witches.entry.style.display = "none";
        sand_witches.clue.style.display = "none";
        sand_witches.message.style.display = "initial";
        sand_witches.message.innerHTML = msg.text;
    }

    /** @param{Message} msg */
    show_clue(msg) {
        sand_witches.entry.style.display = "flex";
        sand_witches.entry.style.visibility = "visible";
        sand_witches.clue.style.display = "block";
        sand_witches.clueanswer.style.display = "block";
        sand_witches.message.style.display = "none";
        sand_witches.skip.disabled = false;

        sand_witches.clue.innerHTML = msg.clue;
        sand_witches.clueanswer.innerHTML = msg.blanks;
	if (document.activeElement.tagName != "INPUT") sand_witches.text.focus();
    }

    /** @param{Message} msg */
    show_answer(msg) {
        sand_witches.entry.style.display = "flex";
        sand_witches.entry.style.visibility = "hidden";
        sand_witches.clue.style.display = "block";
        sand_witches.clueanswer.style.display = "initial";
        sand_witches.message.style.display = "none";
        sand_witches.clue.innerHTML = msg.clue;
        sand_witches.clueanswer.innerHTML = msg.answer;
    }

    /** @param{Message} msg */
    show_all(msg) {
        sand_witches.entry.style.display = "none";
        sand_witches.clue.style.display = "none";
        sand_witches.clueanswer.style.display = "none";
        sand_witches.message.style.display = "flex";

        sand_witches.message.innerHTML = "";
        var table = goog.dom.createDom("TABLE", "sandall");
        for (var i = 0; i < msg.all.length; ++i) {
            var a = msg.all[i];
            var td = goog.dom.createDom("TD", "sandallclue");
            td.innerHTML = a[0];
            var tr = goog.dom.createDom("TR", null,
                                        td,
                                        goog.dom.createDom("TD", "sandallanswer", a[1]));
            table.appendChild(tr);
        }
        sand_witches.message.appendChild(table);
    }

    /** @param{Message} msg */
    add_chat(msg) {
	var curr = goog.dom.getChildren(sand_witches.chat);
	if (curr.length > 3) {
	    goog.dom.removeNode(curr[0]);
	}
	var el = goog.dom.createDom("P");
        el.innerHTML = msg.text;
	sand_witches.chat.appendChild(el);
    }
}

function sand_witches_submit(textel, e) {
    var answer = textel.value;
    if (answer == "") return;
    textel.value = "";
    var username = sand_witches.who.value;
    localStorage.setItem("name", username);
    var msg = sand_witches.serializer.serialize({"answer": answer, "who": username});
    goog.net.XhrIo.send("/sandsubmit", Common_expect_204, "POST", msg);
    e.preventDefault();
}

function sand_witches_onkeydown(textel, e) {
    if (e.keyCode == goog.events.KeyCodes.ENTER) {
	sand_witches_submit(textel, e);
    }
}

function sand_witches_skip(e) {
    sand_witches.skip.disabled = true;
    var username = sand_witches.who.value;
    var msg = sand_witches.serializer.serialize({"who": username});
    goog.net.XhrIo.send("/sandskip", Common_expect_204, "POST", msg);
}

function sand_witches_send_name() {
    var name = sand_witches.who.value;
    if (name != sand_witches.sent_name) {
        sand_witches.sent_name = name;
        var msg = sand_witches.serializer.serialize({"who": name});
        goog.net.XhrIo.send("/sandname", Common_expect_204, "POST", msg);
    }
}

var sand_witches = {
    waiter: null,
    entry: null,
    message: null,
    text: null,
    who: null,
    chat: null,
    clue: null,
    clueanswer: null,
    skip: null,
    sent_name: null,
}

puzzle_init = function() {
    sand_witches.serializer = new goog.json.Serializer();

    sand_witches.body = goog.dom.getElement("puzz");
    sand_witches.entry = goog.dom.getElement("entry");
    sand_witches.text = goog.dom.getElement("text");
    sand_witches.who = goog.dom.getElement("who");
    sand_witches.who.value = localStorage.getItem("name");
    sand_witches.chat = goog.dom.getElement("chat");
    sand_witches.clue = goog.dom.getElement("clue");
    sand_witches.clueanswer = goog.dom.getElement("clueanswer");
    sand_witches.message = goog.dom.getElement("message");
    sand_witches.skip = goog.dom.getElement("sandskip");

    goog.events.listen(goog.dom.getElement("text"),
		       goog.events.EventType.KEYDOWN,
		       goog.bind(sand_witches_onkeydown, null, sand_witches.text));
    goog.events.listen(goog.dom.getElement("sandsubmit"),
		       goog.events.EventType.CLICK,
                       goog.bind(sand_witches_submit, null, sand_witches.text));
    goog.events.listen(sand_witches.skip, goog.events.EventType.CLICK, sand_witches_skip);

    sand_witches.waiter = new Common_Waiter(new SandWitchesDispatcher(), "/sandwait", 0, null, null);
    sand_witches.waiter.start();

    setInterval(sand_witches_send_name, 1000);
}

