import { expect, test } from "@playwright/test";
test("personal agenda requires a session and fits mobile and desktop",async({page})=>{
  for(const width of [375,1280]) {
    await page.setViewportSize({width,height:800});
    await page.goto("/my-programs/01900000-0000-7000-8000-000000000905/agenda");
    await expect(page.getByRole("heading",{name:"Mi agenda",exact:true})).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Tu sesión no está disponible");
    await expect(page.getByRole("form")).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
});
