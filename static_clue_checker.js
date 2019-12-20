/*
 *  Beware: SPOILERS!
 */
var alal = 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ';
function r13(s) {
    s = s.toUpperCase();
    var retval = '';
    for (var i = 0; i < s.length; i++) {
        ixof = alal.indexOf(s[i]);
	if (ixof < 0) {
	    retval += s[i];
	} else {
	    retval += alal[ixof+13];
	}
    }
    return retval;
}
function canonicalize(s) { /* just letters, plz */
    s = s.toUpperCase()
    var retval = '';
    for (var i = 0; i < s.length; i++) {
        ixof = alal.indexOf(s[i]);
	if (ixof < 0) {
	    continue
	} else {
	    retval += s[i];
	}
    }
    return retval;
}


function doCheck(event) {
    var gtv = document.getElementById('guesstext').value;
    var cs = document.getElementById('checkstatus');
    var query = r13(canonicalize(gtv));
    var spoilers = [
	['UNEZ HCF', 'bl1'],
	['FGNXR GB EVQR', 'bl2'],
	['FGERGPURQ BAR', 'bl3'],
	['JBA QRNY: AVPRE YNAQ', 'bl4'],
	['GRAQVAT LRNEF', 'bl5'],
	['OYNZR AVPX', 'bl6'],
	['ZBHFR QRA ENGVBA', 'bl7'],
	['JNVG YNQ, GLVAT', 'bl8'],
	['VEBAVP YNCF', 'bl9'],
	['URNG RNEF, FIRA', 'bl10'],
	["UNA'F PBZRQL", 'bl11'],
	['NTEN AHG VQ', 'bl12'],
	['ZVAR ORNEQ', 'bl13'],
    ];
    for (var i = 0; i < spoilers.length; i++) {
	var canon = canonicalize(spoilers[i][0]);
	if (canon == query) {
	    cs.innerHTML = 'Yes!';
	    var blanks = document.getElementById(spoilers[i][1]);
	    blanks.innerHTML = r13(spoilers[i][0]);
	    return;
	}
	cs.innerHTML = 'No';
    }
}

function maybeCheck(event) {
    var cs = document.getElementById('checkstatus');
    if (event.keyCode == 13) {
	doCheck();
    }
}
