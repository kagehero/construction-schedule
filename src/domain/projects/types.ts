export type ContractType = "請負" | "常用" | "追加工事";

export interface Project {
  id: string;
  title: string;
  customerId?: string | null;
  customerName: string;
  siteName: string;
  contractType: ContractType;
  contractAmount?: number;
  siteAddress: string;
  startDate: string; // ISO date (yyyy-MM-dd)
  endDate: string; // ISO date (yyyy-MM-dd)
}


