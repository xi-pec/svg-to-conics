import { existsSync, readFileSync, writeFileSync } from "fs";

import { XMLParser } from "fast-xml-parser";
import SVGParser, { CommandMadeAbsolute } from "svg-path-parser";

// @ts-ignore
import c2q from "cubic2quad";

type Equation = LinearEquation | ParabolicEquation

type LinearEquation = {
    type: "linear"
    equation: string,
    domain: string
}

type ParabolicEquation = {
    type: "parabolic",
    equation: string,
    domain: string,
    range: string
}

function parse(path: string): SVGParser.CommandMadeAbsolute[] | null {
    if (!existsSync(path)) return null;

    const data = readFileSync(path).toString();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
    const parsed = parser.parse(data);
    const paths = parsed.svg.g.path;
    const pathdata = paths.map((path: { d: string }) => path.d);
    const parsedpaths = pathdata.map((data: string) => SVGParser.parseSVG(data));
    const absolutepaths = parsedpaths.map((cmds: SVGParser.Command[]) => SVGParser.makeAbsolute(cmds));

    return absolutepaths.flat();
}

function preprocess(cmds: SVGParser.CommandMadeAbsolute[], scale = 10, precision = 0.3): SVGParser.CommandMadeAbsolute[] {
    const negated = cmds.map(cmd => {
        const copy = { ...cmd };
        const code = copy.code;
        
        if (code == "C" || code == "Q") {
            copy.y1 = -copy.y1;
        }

        if (code == "C" || code == "S") {
            copy.y2 = -copy.y2;
        }

        if (code == "A") {
            copy.ry = -copy.ry;
        }

        copy.y0 = -copy.y0;
        copy.y = -copy.y;

        return copy;
    });
    
    const scaled = negated.flatMap(cmd => {
        const copy = { ...cmd };
        const code = copy.code;

        copy.x *= scale;
        copy.y *= scale;
        copy.x0 *= scale;
        copy.y0 *= scale;
        
        if (code == "C" || code == "Q") {
            copy.x1 *= 10;
            copy.y1 *= 10;
        }

        if (code == "C" || code == "S") {
            copy.x2 *= 10;
            copy.y2 *= 10;
        }

        return copy;
    });

    const converted = scaled.flatMap(cmd => {
        const copy = { ...cmd };

        if (copy.code == "C") {
            const newcmds: SVGParser.CommandMadeAbsolute[] = [];

            const { x0, y0, x1, y1, x2, y2, x, y } = copy;
            const quads = c2q(x0, y0, x1, y1, x2, y2, x, y, precision) as number[];

            const current = { x: quads.shift()!, y: quads.shift()! };
            newcmds.push({
                code: "M",
                command: "moveto",
                relative: false,
                x: current.x,
                y: current.y,
                x0: 0,
                y0: 0
            });

            while (quads.length >= 4) {
                const cmddata: CommandMadeAbsolute = {
                    code: "Q",
                    command: "quadratic curveto",
                    relative: false,
                    x0: current.x,
                    y0: current.y,
                    x1: quads.shift()!,
                    y1: quads.shift()!,
                    x: quads.shift()!,
                    y: quads.shift()!
                };

                current.x = cmddata.x;
                current.y = cmddata.y;

                newcmds.push(cmddata);
            }

            return newcmds;
        } else return copy;
    });


    return converted;
}

function exponentify(number: number): string {
    const stringified = number.toString();

    if (stringified.includes("e")) {
        const split = stringified.split("e");

        const base = split[0];
        const exponent = split[1];

        return `${base}\\cdot10^{${exponent}}`;
    } else return stringified;
}

function signs(equation: string): string {
    return equation
        .split("+ -").join("-")
        .split("- -").join("+");
}

function process(cmds: SVGParser.CommandMadeAbsolute[]) {
    const equations: Equation[] = [];
    
    for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];

        switch(cmd.code) {
            case "V":
            case "H":
            case "L": {
                const { x, y, x0, y0 } = cmd;

                const m = (y - y0) / (x - x0);
                const h = y0 - m * x0;

                const a = Math.pow(m, 2);
                const b = 2 * m;
                const d = 2 * m * h;
                const e = 2 * h;
                const f = Math.pow(h, 2);

                if (!isFinite(a) || !isFinite(b) || !isFinite(d) || !isFinite(e) || !isFinite(f)) {
                    equations.push({
                        type: "linear",
                        equation: signs(`0x^2 + 0xy + 0y^2 + 1x + 0y - ${x0} = 0`),
                        domain: `${exponentify(Math.min(y0, y))} \\leq y \\leq ${exponentify(Math.max(y0, y))}`
                    });
                } else {
                    equations.push({
                        type: "linear",
                        equation: signs(`${exponentify(a)}x^2 - ${exponentify(b)}xy + y^2 + ${exponentify(d)}x - ${exponentify(e)}y + ${exponentify(f)} = 0`),
                        domain: `${exponentify(Math.min(x0, x))} \\leq x \\leq ${exponentify(Math.max(x0, x))}`
                    });
                }
            } break;

            case "Q": {
                const { x, y, x0, y0, x1, y1 } = cmd;

                // START OF AI GENERATED CODE //
                const Ax = 2 * (x1 - x0);
                const Ay = 2 * (y1 - y0);
                const Bx = x0 - 2 * x1 + x;
                const By = y0 - 2 * y1 + y;

                const delta = By * Ax - Bx * Ay;

                let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0;

                d += delta * delta;
                f += -x0 * delta * delta;

                d += -Ax * By * delta;
                e += Ax * Bx * delta;
                f += (Ax * By * x0 - Ax * Bx * y0) * delta;

                a += -Bx * By * By;
                d += 2 * Bx * By * By * x0;
                f += -Bx * By * By * x0 * x0;

                b += 2 * Bx * Bx * By;
                d += -2 * Bx * Bx * By * y0;
                e += -2 * Bx * Bx * By * x0;
                f += 2 * Bx * Bx * By * x0 * y0;

                c += -Bx * Bx * Bx;
                e += 2 * Bx * Bx * Bx * y0;
                f += -Bx * Bx * Bx * y0 * y0;
                // END OF AI GENERATED CODE //

                if (a == 0 && b == 0 && c == 0 && d == 0 && e == 0 && f == 0) {
                    // fallback to line

                    const m = (y - y0) / (x - x0);
                    const h = y0 - m * x0;

                    const a = Math.pow(m, 2);
                    const b = 2 * m;
                    const d = 2 * m * h;
                    const e = 2 * h;
                    const f = Math.pow(h, 2);

                    if (!isFinite(a) || !isFinite(b) || !isFinite(d) || !isFinite(e) || !isFinite(f)) {
                        equations.push({
                            type: "linear",
                            equation: signs(`0x^2 + 0xy + 0y^2 + 1x + 0y - ${x0} = 0`),
                            domain: `${exponentify(Math.min(y0, y))} \\leq y \\leq ${exponentify(Math.max(y0, y))}`
                        });
                    } else {
                        equations.push({
                            type: "linear",
                            equation: signs(`${exponentify(a)}x^2 - ${exponentify(b)}xy + y^2 + ${exponentify(d)}x - ${exponentify(e)}y + ${exponentify(f)} = 0`),
                            domain: `${exponentify(Math.min(x0, x))} \\leq x \\leq ${exponentify(Math.max(x0, x))}`
                        });
                    }
                } else {
                    equations.push({
                        type: "parabolic",
                        equation: signs(`${exponentify(a)}x^2 + ${exponentify(b)}xy + ${exponentify(c)}y^2 + ${exponentify(d)}x + ${exponentify(e)}y + ${exponentify(f)} = 0`),
                        domain: `${exponentify(Math.min(x0, x1, x))} \\leq x \\leq ${exponentify(Math.max(x0, x1, x))}`,
                        range: `${exponentify(Math.min(y0, y1, y))} \\leq y \\leq ${exponentify(Math.max(y0, y1, y))}`
                    });
                }
            } break;

            case "Z": {
                const { x, y } = cmd;
                const { x0, y0 } = cmds[i - 1];
                
                const m = (y - y0) / (x - x0);
                const h = y0 - m * x0;

                const a = Math.pow(m, 2);
                const b = 2 * m;
                const d = 2 * m * h;
                const e = 2 * h;
                const f = Math.pow(h, 2);

                if (!isFinite(a) || !isFinite(b) || !isFinite(d) || !isFinite(e) || !isFinite(f)) {
                    equations.push({
                        type: "linear",
                        equation: signs(`0x^2 + 0xy + 0y^2 + 1x + 0y - ${x0} = 0`),
                        domain: `${exponentify(Math.min(y0, y))} \\leq y \\leq ${exponentify(Math.max(y0, y))}`
                    });
                } else {
                    equations.push({
                        type: "linear",
                        equation: signs(`${exponentify(a)}x^2 - ${exponentify(b)}xy + y^2 + ${exponentify(d)}x - ${exponentify(e)}y + ${exponentify(f)} = 0`),
                        domain: `${exponentify(Math.min(x0, x))} \\leq x \\leq ${exponentify(Math.max(x0, x))}`
                    });
                }

                equations.push({
                    type: "linear",
                    equation: signs(`${exponentify(a)}x^2 - ${exponentify(b)}xy + y^2 + ${exponentify(d)}x - ${exponentify(e)}y + ${exponentify(f)} = 0`),
                    domain: `${exponentify(Math.min(x0, x))} \\leq x \\leq ${exponentify(Math.max(x0, x))}`
                });
            } break;

            case "M": {
                // nothing
            } break;

            default:
                console.log(`Ignored command ${cmd.command}.`);
                console.log(cmd);
        }
    }

    return equations;
}

function output(equations: Equation[]) {
    const data = equations.map(equation => {
        if (equation.type == "linear") {
            return `${equation.equation}\\left\\{${equation.domain}\\right\\}`;
        } else if (equation.type == "parabolic") {
            return `${equation.equation}\\left\\{${equation.domain}\\right\\}\\left\\{${equation.range}\\right\\}`;
        }
    });

    writeFileSync("equations.txt", data.join("\n"));
}

function main(): void {
    const start = Date.now();

    const parsed = parse("input.svg");
    const preprocessed = preprocess(parsed ?? [], 10, 0.3);
    const equations = process(preprocessed);
    
    output(equations);

    const end = Date.now();

    console.log(`Generated ${equations.length} equations.`);
    console.log(`Took ${(end - start) / 1000}s.`);
}

main();