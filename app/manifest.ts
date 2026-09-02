import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "멍냥앨범",
    short_name: "멍냥앨범",
    description: "우리 아이의 모든 순간을 한곳에",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF9F1",
    theme_color: "#F47E66",
    icons: [{ src: "/brand-reference.png", sizes: "941x1672", type: "image/png" }]
  };
}
