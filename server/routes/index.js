// Mounts every data route under a single base prefix.
import profile from "./profile.js";
import plan from "./plan.js";
import behavior from "./behavior.js";
import assessment from "./assessment.js";
import checkins from "./checkins.js";
import mealPlans from "./meal-plans.js";
import foodLogs from "./food-logs.js";
import chatEvents from "./chat-events.js";
import reflections from "./reflections.js";
import events from "./events.js";
import consultations from "./consultations.js";
import nutrition, { foodReferenceRouter } from "./nutrition.js";
import admin from "./admin.js";
import profilePhotos from "./profile-photos.js";

export function registerRoutes(app, base = "/api/v1") {
  app.use(`${base}/profile`, profile);
  app.use(`${base}/plan`, plan);
  app.use(`${base}/behavior`, behavior);
  app.use(`${base}/assessment`, assessment);
  app.use(`${base}/checkins`, checkins);
  app.use(`${base}/meal-plans`, mealPlans);
  app.use(`${base}/food-logs`, foodLogs);
  app.use(`${base}/chat-events`, chatEvents);
  app.use(`${base}/reflections`, reflections);
  app.use(`${base}/events`, events);
  app.use(`${base}/consultations`, consultations);
  app.use(`${base}/nutrition`, nutrition);
  app.use(`${base}/food-reference`, foodReferenceRouter);
  app.use(`${base}/admin`, admin);
  app.use(`${base}/profile-photos`, profilePhotos);
}
