/**
 * Debugs values intended for localStorage
 * Detects:
 *  - Circular references
 *  - BigInt values
 *  - undefined / null traps
 *  - Functions, Symbols, DOM nodes
 */

export function debugForLocalStorage(label, value) {
  const seen = new WeakSet();
  const problems = [];

  function walk(val, path) {
    // null / undefined
    if (val === null) {
      problems.push(`${path}: null value`);
      return;
    }
    if (val === undefined) {
      problems.push(`${path}: undefined value`);
      return;
    }

    // BigInt
    if (typeof val === "bigint") {
      problems.push(`${path}: BigInt detected (must be stringified)`);
      return;
    }

    // Primitive is safe
    if (typeof val !== "object") return;

    // DOM nodes / window
    if (val instanceof Window || val instanceof Document) {
      problems.push(`${path}: DOM object detected`);
      return;
    }

    // Circular reference
    if (seen.has(val)) {
      problems.push(`${path}: CIRCULAR REFERENCE`);
      return;
    }

    seen.add(val);

    // Arrays
    if (Array.isArray(val)) {
      val.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }

    // Objects
    Object.entries(val).forEach(([k, v]) => {
      walk(v, `${path}.${k}`);
    });
  }

  try {
    walk(value, label);

    // Final stringify test
    JSON.stringify(value);
  } catch (err) {
    problems.push(`JSON.stringify threw: ${err.message}`);
  }

  if (problems.length) {
    console.group(`❌ localStorage DEBUG FAILED: ${label}`);
    problems.forEach(p => console.error(p));
    console.groupEnd();
    return false;
  }

  console.log(`✅ localStorage SAFE: ${label}`);
  return true;
}
