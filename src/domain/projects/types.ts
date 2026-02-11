export type ContractType = "請負" | "常用" | "追加工事";

export interface Project {
  id: string;
  title: string;
  customerId?: string | null;
  customerName: string;
  siteName: string;
  contractType: ContractType;
  contractAmount?: number;
  /** 案件メモ（任意） */
  memo?: string;
  /** 現場ステータス（例: 計画中 / 稼働中 / 完了） */
  siteStatus?: string;
  siteAddress: string;
  startDate: string; // ISO date (yyyy-MM-dd)
  endDate: string; // ISO date (yyyy-MM-dd)
}


