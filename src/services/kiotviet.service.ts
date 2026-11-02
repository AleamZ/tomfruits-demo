import axiosInstance from "./main.service";

export interface KiotVietStatus {
  lastSyncAt: string | null;
  productCount: number;
  branches: { id: number; name: string; address?: string }[];
  syncIntervalMinutes: number;
  log: { at: string; type: string; message: string }[];
}

export const getKiotVietStatus = async (): Promise<KiotVietStatus> => {
  const response = await axiosInstance.get("/kiotviet/status");
  return response.data.data;
};

export const syncKiotViet = async (full = false) => {
  const response = await axiosInstance.post("/kiotviet/sync", null, { params: { full } });
  return response.data.data as { count: number; removed: number; lastSyncAt: string };
};
