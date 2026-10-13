import { useQuery } from "@tanstack/react-query";

export interface RoomCategoryOption {
  _id: string;
  name: string;
  basePrice?: number;
}

/** Active room categories (public list). The one source for room-type pickers. */
export function useRoomCategories() {
  return useQuery<RoomCategoryOption[]>({
    queryKey: ["public-room-categories"],
    queryFn: async () => {
      const res = await fetch("/api/rooms/categories");
      const json = await res.json();
      return json.success ? json.data : [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
