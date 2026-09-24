export enum UserRole {
  Admin = 'Admin',
  FinanceManager = 'FinanceManager',
  ProjectManager = 'ProjectManager',
  Accountant = 'Accountant',
  Viewer = 'Viewer'
}

export enum BudgetStatus {
  Draft = 'Draft',
  Submitted = 'Submitted',
  Approved = 'Approved',
  Rejected = 'Rejected'
}

export enum Currency {
  CNY = 'CNY',
  USD = 'USD'
}

export enum CostCategory {
  Material = 'Material',
  Labor = 'Labor',
  Equipment = 'Equipment',
  Subcontract = 'Subcontract',
  Overhead = 'Overhead',
  Other = 'Other'
}

export enum CostItemStatus {
  Normal = 'Normal',
  VarianceReviewed = 'VarianceReviewed',
  Exception = 'Exception'
}

export enum ChangeType {
  ScopeChange = 'ScopeChange',
  DesignChange = 'DesignChange',
  PriceAdjustment = 'PriceAdjustment',
  UnforeseenCondition = 'UnforeseenCondition'
}

export enum ChangeOrderStatus {
  Draft = 'Draft',
  Submitted = 'Submitted',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Cancelled = 'Cancelled'
}

export enum ReportPeriod {
  Monthly = 'Monthly',
  Quarterly = 'Quarterly'
}

export enum ReportType {
  Monthly = 'Monthly',
  Quarterly = 'Quarterly',
  Annual = 'Annual',
  Custom = 'Custom'
}

export enum AuditAction {
  BudgetCreated = 'BudgetCreated',
  BudgetSubmitted = 'BudgetSubmitted',
  BudgetApproved = 'BudgetApproved',
  BudgetRejected = 'BudgetRejected',
  CostItemCreated = 'CostItemCreated',
  CostItemReviewed = 'CostItemReviewed',
  CostItemMarkedException = 'CostItemMarkedException',
  ChangeOrderCreated = 'ChangeOrderCreated',
  ChangeOrderSubmitted = 'ChangeOrderSubmitted',
  ChangeOrderApproved = 'ChangeOrderApproved',
  ChangeOrderRejected = 'ChangeOrderRejected',
  ChangeOrderCancelled = 'ChangeOrderCancelled',
  ReportGenerated = 'ReportGenerated'
}
