import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { upsert } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

r.put("/:date", async (req, res) => {
  const {
    emotion = null,
    hungerLevel = null,
    hardestPart = null,
    sweetPointDone = null,
    dayWin = null,
  } = req.body || {};
  try {
    await upsert(
      "public.evening_reflections",
      ["user_id", "date"],
      [req.userId, req.params.date],
      {
        emotion,
        hunger_level: hungerLevel,
        hardest_part: hardestPart,
        sweet_point_done: sweetPointDone,
        day_win: dayWin,
      }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /reflections/:date:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;
