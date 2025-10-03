import { readFileSync, writeFileSync } from "fs";

// @ts-ignore
import c2q from "cubic2quad";

function parse(data: string) {
    return Array.from(data.matchAll(/d="([^"]*)"/g)).map(e => e[1]);
}

function tokenize(data: string[]): (string | number)[][] {
    return Array.from(data).map((d) => {
        const cmdRe = /[MmLlHhVvCcSsQqTtAaZz]/g;
        const numRe = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

        const tokens: (string | number)[] = [];
        let lastIndex = 0;

        d.replace(cmdRe, (match, offset) => {
            if (offset > lastIndex) {
                const chunk = d.slice(lastIndex, offset);
                const nums = chunk.match(numRe);
                if (nums) tokens.push(...nums.map(Number));
            }
            tokens.push(match);
            lastIndex = offset + match.length;
            return match;
        });

        if (lastIndex < d.length) {
            const chunk = d.slice(lastIndex);
            const nums = chunk.match(numRe);
            if (nums) tokens.push(...nums.map(Number));
        }

        return tokens;
    });
}

function preprocess(tokens: (string | number)[][]) {
    return tokens.map(token => {
        const newtoken: (string | number)[] = [];

        const cur = { x: 0, y: 0 };

        while (token.length) {
            const cmd = token.shift();
            newtoken.push(cmd as string);

            if (cmd == "m") {
                const dx = token.shift() as number;
                const dy = token.shift() as number;

                newtoken.push(dx, dy);

                cur.x += dx;
                cur.y += dy;
            } else if (cmd == "c") {
                const dx1 = token.shift() as number;
                const dy1 = token.shift() as number;
                const dx2 = token.shift() as number;
                const dy2 = token.shift() as number;
                const dx3 = token.shift() as number;
                const dy3 = token.shift() as number;

                const x1 = cur.x;
                const y1 = cur.y;
                const x2 = cur.x + dx1;
                const y2 = cur.y + dy1;
                const x3 = cur.x + dx2;
                const y3 = cur.y + dy2;
                const x4 = cur.x + dx3;
                const y4 = cur.y + dy3;

                const quads = c2q(x1, y1, x2, y2, x3, y3, x4, y4, 0.33);
                const count = (quads.length - 2) / 4;

                const qx = quads.shift();
                const qy = quads.shift();
                newtoken.push("m", qx - cur.x, qy - cur.y);

                cur.x = qx;
                cur.y = qy;

                for (let i = 0; i < count; i++) {
                    const qx1 = quads.shift();
                    const qy1 = quads.shift();
                    const qx2 = quads.shift();
                    const qy2 = quads.shift();

                    const qdx1 = qx1 - cur.x;
                    const qdy1 = qy1 - cur.y;
                    const qdx2 = qx2 - cur.x;
                    const qdy2 = qy2 - cur.y;

                    cur.x = qx2;
                    cur.y = qy2;

                    newtoken.push("q", qdx1, qdy1, qdx2, qdy2);
                }
                
                cur.x = x4;
                cur.y = y4;
            }
        }
        
        return newtoken;
    });
}

function process(pathdata: (string | number)[][]) {
    const eqs = [];

    for (const tokens of pathdata) {
        const copy = Array.from(tokens);

        let cmd = null;
        const cur = { x: 0, y: 0 }; // 598x748
    
        while (copy.length) {
            cmd = copy.shift();

            let x1 = 0, x2 = 0, x3 = 0, y1 = 0, y2 = 0, y3 = 0, a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, m = 0;
            switch(cmd) {
                case "m":
                    cur.x += copy.shift() as number;
                    cur.y -= copy.shift() as number;
                    break;

                case "q": {
                    x1 = cur.x;
                    y1 = cur.y;
                    x2 = cur.x + (copy.shift() as number);
                    y2 = cur.y - (copy.shift() as number);
                    x3 = cur.x + (copy.shift() as number);
                    y3 = cur.y - (copy.shift() as number);
                    
                    // cur.x += copy.shift() as number
                    // cur.y -= copy.shift() as number
                    cur.x = x3;
                    cur.y = y3;

                    const Ax = 2 * (x2 - x1);
                    const Ay = 2 * (y2 - y1);
                    const Bx = x1 - 2 * x2 + x3;
                    const By = y1 - 2 * y2 + y3;

                    const Δ = By * Ax - Bx * Ay;

                    a += 0; b += 0; c += 0;
                    d += Δ*Δ;
                    e += 0;
                    f += -x1*Δ*Δ;

                    a += 0; c += 0;
                    d += -Ax*By*Δ;
                    e += Ax*Bx*Δ;
                    f += (Ax*By*x1 - Ax*Bx*y1)*Δ;

                    a += -Bx*By*By;
                    d += 2*Bx*By*By*x1;
                    f += -Bx*By*By*x1*x1;

                    b += 2*Bx*Bx*By;
                    d += -2*Bx*Bx*By*y1;
                    e += -2*Bx*Bx*By*x1;
                    f += 2*Bx*Bx*By*x1*y1;

                    c += -Bx*Bx*Bx;
                    e += 2*Bx*Bx*Bx*y1;
                    f += -Bx*Bx*Bx*y1*y1;

                    eqs.push({
                        equation: `${a}x^2 + ${b}xy + ${c}y^2 + ${d}x + ${e}y + ${f} = 0`,
                        domain: `${Math.min(x1, x2, x3)} \\leq x \\leq ${Math.max(x1, x2, x3)}`,
                        range: `${Math.min(y1, y2, y3)} \\leq y \\leq ${Math.max(y1, y2, y3)}`
                    });
                } break;

                case "l":
                    x1 = cur.x;
                    y1 = cur.y;
                    x2 = x1 + (copy.shift() as number);
                    y2 = y1 - (copy.shift() as number);

                    cur.x = x2;
                    cur.y = y2;

                    m = (y2 - y1) / (x2 - x1);
                    b = y1 - m * x1;
                    eqs.push({
                        equation: `${Math.pow(m, 2)}x^2 - ${2 * m}xy + y^2 + ${2 * m * b}x - ${2 * b}y + ${Math.pow(b, 2)} = 0`,
                        domain: `${Math.min(x1, x2)} \\leq x \\leq ${Math.max(x1, x2)}`
                    });
                    break;

                case "z":
                    continue;

                default:
                    console.log(`what: ${cmd}`);
                    continue;
            }
        }
    }

    return eqs;
}

async function main(): Promise<void> {
    const paths = parse(readFileSync("input.txt").toString());
    const tokens = tokenize(paths);
    const processed = preprocess(tokens);
    console.log(processed);
    const eqs = process(processed);

    const data = eqs.map(e => `${e.equation}\\left\\{${e.domain}\\right\\}${e.range ? `\\left\\{${e.range}\\right\\}` : ""}`).join("\n");
    writeFileSync("out.txt", data);
}

main();

