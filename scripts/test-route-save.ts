import { saveTaskRoute, getTaskRoutes, listProviders } from "@/lib/actions/ai-providers";
import { getUser } from "@/lib/auth";

async function main() {
  const { userId } = await getUser();
  console.log("userId", userId);
  const providers = await listProviders();
  console.log("providers", providers.map(p=>`${p.name}:${p.id.slice(0,8)}`));
  const routesBefore = await getTaskRoutes();
  console.log("routesBefore", JSON.stringify(routesBefore, null, 2));
  // Try to move text hierarchy: swap order
  const textIds = routesBefore.text.map(p=>p.id);
  console.log("textIds before", textIds);
  if (textIds.length >=2) {
    const swapped = [textIds[1], textIds[0], ...textIds.slice(2)];
    console.log("trying swapped", swapped);
    const res = await saveTaskRoute("text", swapped);
    console.log("save result", res);
    const routesAfter = await getTaskRoutes();
    console.log("routesAfter text", routesAfter.text.map(p=>p.id));
    if (JSON.stringify(routesAfter.text.map(p=>p.id)) === JSON.stringify(swapped)) {
      console.log("PASS: hierarchy move persisted");
    } else {
      console.log("FAIL: hierarchy not persisted");
    }
    // Try delete
    const removed = swapped.slice(1);
    console.log("trying removed", removed);
    const res2 = await saveTaskRoute("text", removed);
    console.log("save2 result", res2);
    const routesAfter2 = await getTaskRoutes();
    console.log("routesAfter2 text", routesAfter2.text.map(p=>p.id));
    if (JSON.stringify(routesAfter2.text.map(p=>p.id)) === JSON.stringify(removed)) {
      console.log("PASS: delete persisted");
    } else {
      console.log("FAIL: delete not persisted");
    }
    // Restore
    await saveTaskRoute("text", textIds);
    console.log("restored");
  } else {
    console.log("not enough providers to test move");
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
