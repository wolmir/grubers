function df() {
    return 1 - Math.round(Math.random() * 2);
}

function fdf() {
    let result = 0;

    for (let i = 0; i < 4; i++) {
        result += df();
    }

    return result;
}

function mfdf() {
    let result = 0;
    let smallest = 1;

    for (let i = 0; i < 5; i++) {
        const d = df();
        result += d;

        if (d < smallest) {
            smallest = d;
        }
    }

    return result - smallest;
}

function tfdf() {
    let result1 = fdf();
    let result2 = fdf();

    return Math.max(result1, result2);
}

function battle(p1, p2, rounds) {
    const wins = {
        p1: 0,
        p2: 0,
        ties: 0,
    };
    for (let i = 0; i < rounds; i++) {
        let r1 = p1 + fdf();
        let r2 = p2 + fdf();

        if (r1 > r2) {
            wins.p1 += 1;
        } else if (r2 > r1) {
            wins.p2 += 1;
        } else {
            wins.ties += 1;
        }
    }

    return wins;
}

// const statsm = {};
// const statst = {};
// const limit = 1000000;

// for (let j = 0; j < limit; j++) {
//     const resm = mfdf();
//     const rest = tfdf();
//     statsm[resm] = (statsm[resm] || 0) + (1/limit);
//     statst[rest] = (statst[rest] || 0) + (1/limit);
// }

// console.log(statsm);
// console.log(statst);

// console.log(battle(1, 2, 10000));

function cosTable(size) {
    const twoPi = Math.PI * 2;
    const table = new Array(size).fill(0);
    const piece = (twoPi / size);

    for (let i = 0; i < size; i++) {
        const param = piece * i;
        table[i] = Math.cos(param);
    }

    return table;
}

function tableCos(table, size) {
    return function (param) {
        const piece = (Math.PI * 2) / size;
        const round = Math.floor(param / piece);
        // console.log(round);

        return table[round];
    }
}

function d6() {
    return Math.floor(Math.random() * 6) + 1;
}

function getCombo(handParam) {
    const hand = handParam.sort();
    const combos = {};

    for (let i = 0; i < 4; i++) {
        if (hand[i] === hand[i + 1]) {
            if (!combos.pair) {
                combos.pair = hand[i];
            } else {
                combos.twoPair = {
                    pair1: combos.pair,
                    pair2: hand[i],
                };
            }
        }
    }

    for (i = 0; i < 3; i++) {
        if (hand[i] === hand[i + 1]) {
            if (hand[i + 1] === hand[i + 2]) {
                combos.threeOfKind = hand[i];
            }
        }
    }

    for (i = 0; i < 2; i++) {
        if (hand[i] === hand[i + 1]) {
            if (hand[i + 1] === hand[i + 2]) {
                if (hand[i + 2] === hand[i + 3]) {
                    combos.fourOfKind = hand[i];
                }
            }
        }
    }

    if (
        (hand[0] === hand[1])
        && (hand[1] === hand[2])
        && (hand[2] === hand[3])
        && (hand[3] === hand[4])
    ) {
        combos.fiveOfKind = hand[0];
    }

    if (combos.pair && combos.threeOfKind && (combos.pair !== combos.threeOfKind)) {
        combos.fullHouse = {
            value: combos.threeOfKind,
            fullOf: combos.pair,
        }
    }

    if (
        (combos.twoPair && combos.threeOfKind)
    ) {
        combos.fullHouse = {
            value: combos.threeOfKind,
        };

        if (combos.twoPair.pair1 !== combos.threeOfKind) {
            combos.fullHouse.fullOf = combos.twoPair.pair1;
        } else {
            combos.fullHouse.fullOf = combos.twoPair.pair2;
        }
    }

    const txt = hand.join('');

    if (
        (txt === '12345')
        || (txt === '23456')
    ) {
        combos.straight = txt;
    }

    if (combos.fullHouse) {
        if (combos.fullHouse.value === combos.fullHouse.fullOf) {
            delete combos.fullHouse;
        } else {
            delete combos.pair;
            delete combos.threeOfKind;
            delete combos.twoPair;
        }
    }

    if (combos.fiveOfKind) {
        delete combos.fourOfKind;
        delete combos.threeOfKind;
        delete combos.pair;
        delete combos.twoPair;
    }

    if (combos.fourOfKind) {
        delete combos.threeOfKind;
        delete combos.pair;
        delete combos.twoPair;
    }

    if (combos.threeOfKind) {
        delete combos.pair;
        delete combos.twoPair;
    }

    if (combos.twoPair) {
        delete combos.pair;
    }

    if (!Object.keys(combos).length) {
        combos.highPip = hand[4];
    }

    return combos;
}

function dRoll(n = 5) {
    const roll = [];

    for (let i = 0; i < n; i++) {
        roll.push(d6());
    }

    return roll;
}

// const dpokerStats = {};

// for (let j = 0; j < 10 ** 6; j++) {
//     const results = new Array(5).fill(0).map(() => d6());

//     const combos = getCombo(results);
//     const comboNames = Object.keys(combos);

//     if (comboNames.length > 1) {
//         console.log(results, combos);
//         throw new Error('More than one');
//     }

//     if (comboNames.length === 0) {
//         console.log(results, combos);
//         throw new Error('No combos');
//     }

//     dpokerStats[comboNames[0]] = (dpokerStats[comboNames[0]] || 0) + 1;
// }

// console.log(dpokerStats);

function dPokerProgram() {
    const myRolls = dRoll();
    let myStake = 1000;
    let oponentStake = 1000;
    let oponentRolls = dRoll();
    let pot = 0;
    console.log(`Your stake: \$${myStake}`)
    console.log(`Pot: \$${pot}`)
    console.log('Your rolls: ' + myRolls.join(' '))
    console.log('Blinds 1 and 1')
    myStake -= 1;
    oponentStake -= 1;
    pot += 2;
    console.log(`Your stake: \$${myStake}`)
    console.log(`Pot: \$${pot}`)
}

function lcrafter_program() {
    
}

// dPokerProgram();

/**
 * fiveOfKind
 * fourOfKind
 * straight
 * fullHouse
 * highPip
 * threeOfKind
 * twoPair
 * pair
 */
// const tests = {
//     HighPip: [
//         [1, 3, 4, 5, 6],
//     ],
//     Pair: [
//         [1, 1, 3, 4, 5],
//         [6, 2, 3, 4, 3],
//     ],
//     ThreeOfKind: [
//         [1,4,3,4,4],
//         [6,1,1,3,1],
//     ],
//     TwoPair: [
//         [1,1,4,5,5],
//         [4,2,4,3,3],
//     ],

// };

// Object.keys(tests).forEach((name) => {
//     console.log(name);
//     tests[name].forEach((testCase) => {
//         console.log(testCase, getCombo(testCase));
//     });

//     console.log('=============================');
//     console.log();
// });

// const seq = 'TATACTCCACCAGCACTTTACCTTGTCCCCTACATGAGGCGTATCACTAGACAGTGTCCCCTTGGTGGTGGGGGTCATCACGTATTGGACATGTGCAGCATATGCAGGCAGAGAATCCTGCTTTCTTTTATGCAGTCCAGGATGTCAATAATCTCGCGTGTGGGAATATATTTTGGGCTGATGCAACATCGTGTACAAACTACTCTTAACCTGTGTTATTTGGTTGTGCATTGATTTTCAATGAATCTGAGTCGTCATTTATATGGCTATTCAGGACTTGTGACTTCATGCCATGTCTGGCCGCCACCCTGTCTCTATTACAACAGATTTGGCCCTTTCATACAAGTTACTGTTGCCCAAGTTCTCCCTTCAACTCGCCATCGGTTTTGTGAATGGAGCATATGGAAAAACAAGCTGCGAGTTACGGCGTATTCAGAGAAACCCGAGGCAAACTGGCTCATTTATGTCAGTCATATCCTGCTTTTGAAAACTGAATTCAAGAAATGCGTTCATGAAAGTGAGACTATAGGATGAGTTTGAGTCTTATTGGCACTCACTCTTGGAAAGATTCTACGTCATGGACAATGAGTGGCTTCAGTCAATATACAACTCACGACAACATTGGGTTCCTGTGTACTTGCGGGAGACTTTCTTTGGAGAGATATCTTTGAATGAGGGAAATGAATATTTGATTTCTTTCTTTGATGGATATGTGAATTCATCCACCACTCTACAGGTATTGGTTAGACAATACGAGAAAGCCGTGTTCTGAAGTTGGCACGAAAAAGAATTAAAAGCAGATTATGACACTACTAATAGTAGTCCAGTTTTAAAAACACCATCTCCTATGGAAAAACAAGCTGCGAGTCTTTACACGAGAAAGATTGATTCAGGAATAAATCACTACATATCGAGTTGCCAAATTCCCAGCCCGCTAATGAGCGGGCTTTTTACT';

// let state = 'begin';
// let introns = 0;
// let exons = 0;

// for (let i = 0; i < seq.length; i++) {
//     const n = seq[i];

//     switch (state) {
//         case 'begin':
//             handleBegin(n);
//             break;

//         case 'posIntron1':
//             handlePosIntron1(n);
//             break;

//         case 'intron':
//             handleIntron(n);
//             break;

//         case 'posEndIntron':
//             handlePosEndIntron(n);
//             break;
//     }
// }

// function handleBegin(n) {
//     if (n === 'G') {
//         state = 'posIntron1';
//     } else {
//         state = 'begin';
//     }
// }

// function handlePosIntron1(n) {
//     if (n === 'T') {
//         exons += 1;
//         state = 'intron';
//     } else if (n === 'G') {
//         state = 'posIntron1';
//     } else {
//         state = 'begin';
//     }
// }

// function handleIntron(n) {
//     if (n === 'A') {
//         state = 'posEndIntron';
//     } else {
//         state = 'intron';
//     }
// }

// function handlePosEndIntron(n) {
//     if (n === 'G') {
//         state = 'begin';
//         recordIntron();
//     } else if (n === 'A') {
//         state = 'posEndIntron';
//     } else {
//         state = 'intron';
//     }
// }

// function recordIntron() {
//     introns += 1;
// }

// console.log(state, introns, exons);


// const seq2 = 'ATGAGGCGTATCACTAGACAGTGTCCCCTTGGTGGTGGGGGTCATCACGTATTGGACATGTGCAGCATATGCAGGCAGAGAATCCTGCTTTCTTTTATGCAGTCCAGGATGTCAATAATCTCGCGTGTGGGAATATATTTTGGGCTGATGCAACATCGTGTACAAACTACTCTTAACCTGTGTTATTTGGTTGTGCATTGATTTTCAATGAATCTGAGTCGTCATTTATATGGCTATTCAGGACTTGTGACTTCATGCCATGTCTGGCCGCCACCCTGTCTCTATTACAACAGATTTGGCCCTTTCATACAAGTTACTGTTGCCCAAGTTCTCCCTTCAACTCGCCATCGGTTTTGTGAATGGAGCATATGGAAAAACAAGCTGCGAGTTACGGCGTATTCAGAGAAACCCGAGGCAAACTGGCTCATTTATGTCAGTCATATCCTGCTTTTGAAAACTGAATTCAAGAAATGCGTTCATGAAAGTGAGACTATAGGATGAGTTTGAGTCTTATTGGCACTCACTCTTGGAAAGATTCTACGTCATGGACAATGAGTGGCTTCAGTCAATATACAACTCACGACAACATTGGGTTCCTGTGTACTTGCGGGAGACTTTCTTTGGAGAGATATCTTTGAATGAGGGAAATGAATATTTGATTTCTTTCTTTGATGGATATGTGAATTCATCCACCACTCTACAGGTATTGGTTAGACAATACGAGAAAGCCGTGTTCTGA'
// console.log(seq2.length);