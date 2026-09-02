export type Species = "dog" | "cat";
export type Gender = "male" | "female" | "unknown";

export interface Pet {
  id: string;
  user_id: string;
  name: string;
  species: Species;
  breed: string | null;
  gender: Gender;
  birth_date: string | null;
  bio: string | null;
  cover_image_path: string | null;
  cover_url?: string | null;
  created_at: string;
}

export interface Style {
  id: string;
  name: string;
  slug: string;
  description: string;
  thumbnail_url: string | null;
}

export interface Artwork {
  id: string;
  generation_id: string;
  pet_id: string;
  pet_name: string;
  style_name: string;
  storage_path: string;
  url: string;
  is_saved: boolean;
  is_favorite: boolean;
  folder_id: string | null;
  taken_at: string | null;
  note: string | null;
  created_at: string;
}

export interface PetImage {
  id: string;
  pet_id: string;
  user_id: string;
  storage_path: string;
  is_primary: boolean;
  folder_id: string | null;
  taken_at: string | null;
  note: string | null;
  created_at: string;
  url: string;
}

export interface AlbumFolder {
  id: string;
  user_id: string;
  pet_id: string;
  name: string;
  cover_storage_path: string | null;
  cover_bucket: string | null;
  cover_url?: string | null;
  sort_order: number;
  created_at: string;
}

export const seedStyles: Style[] = [
  { id: "1b047451-0101-4001-8001-000000000001", name: "봄날 산책", slug: "spring-walk", description: "꽃길을 걷는 화사한 봄날", thumbnail_url: null },
  { id: "1b047451-0101-4001-8001-000000000002", name: "스튜디오 증명사진", slug: "studio-id", description: "깔끔하고 사랑스러운 정면 사진", thumbnail_url: null },
  { id: "1b047451-0101-4001-8001-000000000003", name: "영화 포스터", slug: "movie-poster", description: "한 편의 영화 같은 주인공 컷", thumbnail_url: null },
  { id: "1b047451-0101-4001-8001-000000000004", name: "클래식 초상화", slug: "classic-portrait", description: "고전 회화 느낌의 품격 있는 초상", thumbnail_url: null },
  { id: "1b047451-0101-4001-8001-000000000005", name: "생일 파티", slug: "birthday-party", description: "케이크와 함께하는 특별한 하루", thumbnail_url: null },
  { id: "1b047451-0101-4001-8001-000000000006", name: "감성 카페", slug: "cozy-cafe", description: "따뜻한 햇살이 드는 감성 카페", thumbnail_url: null }
];
