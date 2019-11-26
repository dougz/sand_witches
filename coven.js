goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.dom.TagName');
goog.require('goog.events');
goog.require('goog.events.KeyCodes');
goog.require('goog.net.XhrIo');
goog.require("goog.json.Serializer");

class CovenDispatcher {
    constructor() {
	this.methods = {
	    "add_chat": goog.bind(this.add_chat, this),
	    "show_message": goog.bind(this.show_message, this),
	    "show_clue": goog.bind(this.show_clue, this),
	    "show_answer": goog.bind(this.show_answer, this),
	    "show_all": goog.bind(this.show_all, this),
	}
    }

    /** @param{Message} msg */
    dispatch(msg) {
	this.methods[msg.method](msg);
    }

    /** @param{Message} msg */
    show_message(msg) {
        coven.entry.style.display = "none";
        coven.clue.style.display = "none";
        coven.message.style.display = "initial";
        coven.message.innerHTML = msg.text;
    }

    /** @param{Message} msg */
    show_clue(msg) {
        coven.entry.style.display = "flex";
        coven.entry.style.visibility = "visible";
        coven.clue.style.display = "block";
        coven.clueanswer.style.display = "block";
        coven.message.style.display = "none";
        coven.skip.disabled = false;

        coven.clue.innerHTML = msg.clue;
        coven.clueanswer.innerHTML = msg.blanks;
	if (document.activeElement.tagName != "INPUT") coven.text.focus();
    }

    /** @param{Message} msg */
    show_answer(msg) {
        coven.entry.style.display = "flex";
        coven.entry.style.visibility = "hidden";
        coven.clue.style.display = "block";
        coven.clueanswer.style.display = "initial";
        coven.message.style.display = "none";
        coven.clue.innerHTML = msg.clue;
        coven.clueanswer.innerHTML = msg.answer;
    }

    /** @param{Message} msg */
    show_all(msg) {
        coven.entry.style.display = "none";
        coven.clue.style.display = "none";
        coven.clueanswer.style.display = "none";
        coven.message.style.display = "flex";

        coven.message.innerHTML = "";
        var table = goog.dom.createDom("TABLE", "covall");
        for (var i = 0; i < msg.all.length; ++i) {
            var a = msg.all[i];
            var td = goog.dom.createDom("TD", "covallclue");
            td.innerHTML = a[0];
            var tr = goog.dom.createDom("TR", null,
                                        td,
                                        goog.dom.createDom("TD", "covallanswer", a[1]));
            table.appendChild(tr);
        }
        coven.message.appendChild(table);
    }

    /** @param{Message} msg */
    add_chat(msg) {
	var curr = goog.dom.getChildren(coven.chat);
	if (curr.length > 3) {
	    goog.dom.removeNode(curr[0]);
	}
	var el = goog.dom.createDom("P", null, msg.text);
	coven.chat.appendChild(el);
    }
}

function coven_submit(textel, e) {
    var answer = textel.value;
    if (answer == "") return;
    textel.value = "";
    var username = coven.who.value;
    localStorage.setItem("name", username);
    var msg = coven.serializer.serialize({"answer": answer, "who": username});
    goog.net.XhrIo.send("/covsubmit", Common_expect_204, "POST", msg);
    e.preventDefault();
}

function coven_onkeydown(textel, e) {
    if (e.keyCode == goog.events.KeyCodes.ENTER) {
	coven_submit(textel, e);
    }
}

function coven_skip(e) {
    coven.skip.disabled = true;
    var username = coven.who.value;
    var msg = coven.serializer.serialize({"who": username});
    goog.net.XhrIo.send("/covskip", Common_expect_204, "POST", msg);
}

var coven = {
    waiter: null,
    entry: null,
    message: null,
    text: null,
    who: null,
    chat: null,
    clue: null,
    clueanswer: null,
    skip: null,
}

puzzle_init = function() {
    coven.serializer = new goog.json.Serializer();

    coven.body = goog.dom.getElement("puzz");
    coven.entry = goog.dom.getElement("entry");
    coven.text = goog.dom.getElement("text");
    coven.who = goog.dom.getElement("who");
    coven.who.value = localStorage.getItem("name");
    coven.chat = goog.dom.getElement("chat");
    coven.clue = goog.dom.getElement("clue");
    coven.clueanswer = goog.dom.getElement("clueanswer");
    coven.message = goog.dom.getElement("message");
    coven.skip = goog.dom.getElement("covskip");

    goog.events.listen(goog.dom.getElement("text"),
		       goog.events.EventType.KEYDOWN,
		       goog.bind(coven_onkeydown, null, coven.text));
    goog.events.listen(goog.dom.getElement("covsubmit"),
		       goog.events.EventType.CLICK,
                       goog.bind(coven_submit, null, coven.text));
    goog.events.listen(coven.skip, goog.events.EventType.CLICK, coven_skip);

    coven.waiter = new Common_Waiter(new CovenDispatcher(), "/covwait", 0, null, null);
    coven.waiter.start();
}

