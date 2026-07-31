// The single source of truth for the Module Map (Admin > Module Map).
// Add a future module by adding an object to the right `children` array below
// — { id, label, icon?, color?, status? } — `icon` is a HugeIcons icon import
// (optional; leaf nodes usually skip it to keep deep trees readable), `color`
// is a hex string (inherited from the parent if omitted), and `status: 'planned'`
// renders the node dashed/dimmed with a "Planned" badge for modules that don't
// exist yet — see "Devices" under Documents for a live example.
import {
  Home01Icon, Analytics01Icon, File01Icon, Calculator01Icon, Settings01Icon, Shield01Icon,
  ClipboardListIcon, UserGroupIcon, Briefcase01Icon, Agreement01Icon, ComputerIcon,
  ExchangeDollarIcon, Database01Icon, InboxIcon, BankIcon, SecurityCheckIcon,
  Book01Icon, ShoppingCart01Icon, SaleTag01Icon, Folder01Icon, Invoice01Icon,
  MoneyBag01Icon, Package01Icon, Calendar03Icon, ArrowDataTransferHorizontalIcon,
  ChatSpark01Icon, InformationCircleIcon, Table01Icon, TaxesIcon, Globe02Icon,
  Menu01Icon, AccountSetting01Icon, UserSettings01Icon, PaintBoardIcon,
  InformationSquareIcon,
} from '@hugeicons/core-free-icons';

export const MODULE_MAP = {
  id: 'root',
  label: 'Finpilot',
  color: '#5c96e0',
  children: [
    {
      id: 'home', label: 'Home', icon: Home01Icon, color: '#f9916b',
    },
    {
      id: 'analytics', label: 'Analytics', icon: Analytics01Icon, color: '#6ac79c',
      children: [
        { id: 'analytics-overview', label: 'Overview' },
        { id: 'analytics-employees', label: 'Employees' },
      ],
    },
    {
      id: 'documents', label: 'Documents', icon: File01Icon, color: '#5c96e0',
      children: [
        { id: 'doc-journal', label: 'Journal', icon: ClipboardListIcon },
        {
          id: 'doc-employees', label: 'Employees', icon: UserGroupIcon,
          children: [
            { id: 'emp-info', label: 'Info' },
            { id: 'emp-salary', label: 'Salary Changes' },
            { id: 'emp-account', label: 'Account Changes' },
            { id: 'emp-documents', label: 'Documents' },
            { id: 'emp-agreement', label: 'Agreement' },
            { id: 'emp-portal', label: 'Portal Access' },
          ],
        },
        { id: 'doc-agents', label: 'Agents / Coagents', icon: Briefcase01Icon },
        { id: 'doc-agreements', label: 'Agreements', icon: Agreement01Icon },
        { id: 'doc-devices', label: 'Devices', icon: ComputerIcon, status: 'planned' },
        { id: 'doc-nbg-rates', label: 'NBG Rates', icon: ExchangeDollarIcon },
        {
          id: 'doc-datalake', label: 'Data Lake', icon: Database01Icon,
          children: [
            { id: 'dl-import', label: 'Import' },
            { id: 'dl-tbcbank', label: 'TBC Bank' },
            { id: 'dl-tables', label: 'Tables' },
          ],
        },
        { id: 'doc-requests', label: 'Requests', icon: InboxIcon },
        {
          id: 'doc-banking', label: 'Banking', icon: BankIcon,
          children: [
            { id: 'bank-settings', label: 'Settings' },
            { id: 'bank-salary-payments', label: 'Salary Payments' },
            { id: 'bank-statements', label: 'Bank Statements' },
            { id: 'bank-pay-invoice', label: 'Pay Invoice' },
          ],
        },
        {
          id: 'doc-rsge', label: 'RS.ge', icon: SecurityCheckIcon,
          children: [
            { id: 'rsge-employees', label: 'Employee Registration' },
            { id: 'rsge-declarations', label: 'Tax Declarations' },
            { id: 'rsge-waybills', label: 'Waybills' },
            { id: 'rsge-einvoices', label: 'E-Invoices' },
          ],
        },
      ],
    },
    {
      id: 'accounting', label: 'Accounting', icon: Calculator01Icon, color: '#625db2',
      children: [
        {
          id: 'acc-bookkeeping', label: 'Bookkeeping', icon: Book01Icon,
          children: [
            { id: 'bk-transactions', label: 'Transactions' },
            { id: 'bk-trial-balance', label: 'Trial Balance' },
            { id: 'bk-subkonto', label: 'Subkonto' },
            { id: 'bk-autopost', label: 'Auto-post Rules' },
          ],
        },
        { id: 'acc-purchases', label: 'Purchases', icon: ShoppingCart01Icon },
        { id: 'acc-sales', label: 'Sales', icon: SaleTag01Icon },
        {
          id: 'acc-projects', label: 'Projects', icon: Folder01Icon,
          children: [
            { id: 'proj-projects', label: 'Projects' },
            { id: 'proj-invoices', label: 'Invoices' },
          ],
        },
        { id: 'acc-invoices', label: 'Invoices', icon: Invoice01Icon },
        {
          id: 'acc-salaries', label: 'Salaries', icon: MoneyBag01Icon,
          children: [
            { id: 'sal-accrual', label: 'Accrual' },
            { id: 'sal-file', label: 'File' },
            { id: 'sal-pit', label: 'PIT' },
            { id: 'sal-transferred', label: 'Transferred' },
          ],
        },
        { id: 'acc-stock', label: 'Stock', icon: Package01Icon },
        { id: 'acc-calendar', label: 'Payment Calendar', icon: Calendar03Icon },
        { id: 'acc-transfers', label: 'Transfers', icon: ArrowDataTransferHorizontalIcon },
        {
          id: 'acc-orders', label: 'Orders', icon: ClipboardListIcon,
          children: [
            { id: 'ord-hiring', label: 'Hiring' },
            { id: 'ord-firing', label: 'Firing' },
            { id: 'ord-promotion', label: 'Promotion' },
            { id: 'ord-adjusting', label: 'Adjusting' },
            { id: 'ord-business-trip', label: 'Business Trip' },
            { id: 'ord-advance', label: 'Advance Payment' },
            { id: 'ord-handover', label: 'Handover' },
            { id: 'ord-bonus', label: 'Bonus' },
          ],
        },
        { id: 'acc-finbot', label: 'FinBot', icon: ChatSpark01Icon },
        { id: 'acc-jet', label: 'Jet' },
      ],
    },
    {
      id: 'options', label: 'Options', icon: Settings01Icon, color: '#d59b41',
      children: [
        { id: 'opt-holidays', label: 'Holidays', icon: Calendar03Icon },
        {
          id: 'opt-info', label: 'Info', icon: InformationCircleIcon,
          children: [
            { id: 'info-positions', label: 'Positions' },
            { id: 'info-units', label: 'Units' },
            { id: 'info-departments', label: 'Departments' },
            { id: 'info-overtime', label: 'Overtime Rates' },
            { id: 'info-stock', label: 'Stock' },
          ],
        },
        { id: 'opt-pagination', label: 'Pagination', icon: Table01Icon },
        { id: 'opt-tax', label: 'Tax', icon: TaxesIcon },
        { id: 'opt-language', label: 'Language', icon: Globe02Icon },
        { id: 'opt-navorder', label: 'Nav Order', icon: Menu01Icon },
        { id: 'opt-accounts', label: 'Accounts', icon: AccountSetting01Icon },
        { id: 'opt-users', label: 'Users (Super Admin)', icon: UserSettings01Icon },
        { id: 'opt-hierarchy', label: 'Hierarchy' },
        {
          id: 'opt-tools', label: 'Tools', icon: Settings01Icon,
          children: [
            { id: 'tools-pdf', label: 'PDF Parsing' },
          ],
        },
        { id: 'opt-telegram', label: 'Telegram' },
        { id: 'opt-whatsapp', label: 'WhatsApp' },
        { id: 'opt-appearance', label: 'Appearance', icon: PaintBoardIcon },
        { id: 'opt-about', label: 'About', icon: InformationSquareIcon },
      ],
    },
    {
      id: 'admin', label: 'Admin', icon: Shield01Icon, color: '#f68ab2',
      children: [
        {
          id: 'admin-companies', label: 'Companies', icon: UserGroupIcon,
          children: [
            { id: 'company-employees', label: 'Employees' },
            { id: 'company-team', label: 'Team Members' },
            { id: 'company-billing', label: 'Billing' },
          ],
        },
        { id: 'admin-users', label: 'All Users' },
        { id: 'admin-chart-designs', label: 'Chart Designs' },
        { id: 'admin-module-map', label: 'Module Map' },
      ],
    },
    {
      id: 'portal', label: 'Employee Portal', color: '#f17972',
      children: [
        { id: 'portal-home', label: 'Home' },
        { id: 'portal-payroll', label: 'Payroll' },
        { id: 'portal-documents', label: 'Documents' },
        { id: 'portal-scan', label: 'Scan' },
      ],
    },
  ],
};
