function run(code) {
    const memory = {};

    const ops = code.split('\n');

    for (let i = 0; i < ops.length; i++) {
        const op = ops[i].trim();
        if (op && op.length) {
            const parts = op.split(' ');
            const cmd = parts[0];

            switch (cmd) {
                case 'co':
                    symTable[parts[1]] = {};
                    break;

                case 'set':
                    const obj = symTable[parts[1]];
                    obj[parts[2]] = resolve(parts[3], symTable) || JSON.parse(parts[3]);
                    break;

                case 'let':
                    symTable[parts[1]] = resolve(parts[2], symTable) || JSON.parse(parts[2]);
                    break;
            }
        }
    }
}

function resolve(name, table) {
    if (table[name]) {
        return table[name];
    }

    return undefined;
}