export type VfBrandGalleryItem = {
  num: number;
  src: string;
  kind: "image" | "video";
};

/** Public media for the VF Brand sponsored gear gallery (1–17). */
export const VF_BRAND_GALLERY_ITEMS: VfBrandGalleryItem[] = [
  { num: 1, src: "/1.mov", kind: "video" },
  { num: 2, src: "/2.png", kind: "image" },
  { num: 3, src: "/3%20(2).png", kind: "image" },
  { num: 4, src: "/4.png", kind: "image" },
  { num: 5, src: "/5.png", kind: "image" },
  { num: 6, src: "/6.png", kind: "image" },
  { num: 7, src: "/7.png", kind: "image" },
  { num: 8, src: "/8.png", kind: "image" },
  { num: 9, src: "/9.png", kind: "image" },
  { num: 10, src: "/10.png", kind: "image" },
  { num: 11, src: "/11.png", kind: "image" },
  { num: 12, src: "/12.png", kind: "image" },
  { num: 13, src: "/13.png", kind: "image" },
  { num: 14, src: "/14.png", kind: "image" },
  { num: 15, src: "/15.jpg", kind: "image" },
  { num: 16, src: "/16.mp4", kind: "video" },
  { num: 17, src: "/17.mov", kind: "video" },
];
