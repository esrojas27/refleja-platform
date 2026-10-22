import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ActivityVideo } from "@/components/participation/activity-video";
import { isYoutubeVideoUrl, youtubeVideoId } from "@/lib/participation/youtube";

afterEach(cleanup);

it.each([
  "https://youtu.be/dQw4w9WgXcQ?si=shared",
  "https://www.youtu.be/dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1",
  "https://m.youtube.com/shorts/dQw4w9WgXcQ",
  "https://youtube.com/live/dQw4w9WgXcQ",
  "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
])("embeds the supported URL %s without forwarding query parameters", url => {
  render(<ActivityVideo url={url} title="Reflexión" />);
  const player = screen.getByTitle("Video de la actividad: Reflexión");
  expect(player.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?hl=es&playsinline=1");
  expect(player.getAttribute("loading")).toBe("lazy");
  expect(player.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
  expect(player.hasAttribute("allowfullscreen")).toBe(true);
  expect(screen.getByRole("link", { name: "Ver video en YouTube" }).getAttribute("href")).toBe(url);
});

it.each([
  "javascript:alert(1)", "http://youtu.be/dQw4w9WgXcQ", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
  "https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ", "https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtube.com:444/watch?v=dQw4w9WgXcQ", "https://youtu.be/short-id", "https://youtu.be/dQw4w9WgXcQ/extra",
  "https://youtube.com/playlist?list=dQw4w9WgXcQ", "https://youtu.be/" + "a".repeat(2048),
])("does not render an iframe or link for an invalid URL %s", url => {
  const { container } = render(<ActivityVideo url={url} title="Reflexión" />);
  expect(container.querySelector("iframe")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(youtubeVideoId(url)).toBeNull();
  expect(isYoutubeVideoUrl(url)).toBe(false);
});

it("keeps the video optional in activity forms", () => {
  expect(isYoutubeVideoUrl("")).toBe(true);
  expect(youtubeVideoId("")).toBeNull();
});
