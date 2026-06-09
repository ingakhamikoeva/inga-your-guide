// Tiny shared upsert helper. ON CONFLICT requires a matching unique index.
import { pool } from "../db.js";

export async function upsert(table, keyCols, keyVals, row) {
  const setEntries = Object.entries(row).filter(([k]) => !keyCols.includes(k));
  const allCols = [...keyCols, ...setEntries.map(([k]) => k)];
  const allVals = [...keyVals, ...setEntries.map(([, v]) => v)];
  const placeholders = allVals.map((_, i) => `$${i + 1}`).join(", ");
  const updates = setEntries.length
    ? setEntries.map(([k], i) => `${k} = $${keyVals.length + 1 + i}`).join(", ")
    : null;
  const sql = `
    INSERT INTO ${table} (${allCols.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (${keyCols.join(", ")})
    DO ${updates ? `UPDATE SET ${updates}` : "NOTHING"}
    RETURNING *`;
  const r = await pool.query(sql, allVals);
  return r.rows[0];
}

export { pool };
