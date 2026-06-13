import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Coins01Icon, CoinsDollarIcon, CoinsEuroIcon, CoinsPoundIcon, CoinsSwapIcon,
  Dollar01Icon, DollarCircleIcon, DollarSquareIcon, EuroIcon, PoundIcon,
  MoneyBag01Icon, MoneyBag02Icon, Cash01Icon, Cash02Icon, CashierIcon,
  Wallet01Icon, CreditCardIcon, GiftCardIcon, BankIcon, BanknoteIcon,
  PiggyBankIcon, SavingsIcon, SafeIcon, Invoice01Icon, Calculator01Icon,
  PercentCircleIcon, PercentIcon, TaxesIcon, DiamondIcon, MoneyExchange01Icon,
  ExchangeDollarIcon, Analytics01Icon, ChartLineData01Icon, ChartUpIcon, ChartIncreaseIcon,
  ChartDecreaseIcon, AnalyticsUpIcon, TradeUpIcon, TradeDownIcon, SaleTag01Icon,
  BanknoteArrowUpIcon, Bitcoin01Icon, BitcoinWalletIcon, BitcoinCircleIcon, AiBrain01Icon,
  AiChat01Icon, AiMagicIcon, AiIdeaIcon, AiNetworkIcon, ChipIcon,
} from '@hugeicons/core-free-icons';

/*
 * App logo library — finance, money & AI themed Hugeicons.
 * Each entry: { id (stored value), name (tooltip), icon (Hugeicons icon) }.
 * Rendered via the <Logo /> helper so the header, picker grid and preview stay in sync.
 */
export const LOGOS = [
  // Money & currency
  { id: 'coins',          name: 'Coins',            icon: Coins01Icon },
  { id: 'coins-dollar',   name: 'Coins Dollar',     icon: CoinsDollarIcon },
  { id: 'coins-euro',     name: 'Coins Euro',       icon: CoinsEuroIcon },
  { id: 'coins-pound',    name: 'Coins Pound',      icon: CoinsPoundIcon },
  { id: 'coins-swap',     name: 'Coins Swap',       icon: CoinsSwapIcon },
  { id: 'dollar',         name: 'Dollar',           icon: Dollar01Icon },
  { id: 'dollar-circle',  name: 'Dollar Circle',    icon: DollarCircleIcon },
  { id: 'dollar-square',  name: 'Dollar Square',    icon: DollarSquareIcon },
  { id: 'euro',           name: 'Euro',             icon: EuroIcon },
  { id: 'pound',          name: 'Pound',            icon: PoundIcon },
  { id: 'money-bag',      name: 'Money Bag',        icon: MoneyBag01Icon },
  { id: 'money-bag-2',    name: 'Money Bag 2',      icon: MoneyBag02Icon },
  { id: 'cash',           name: 'Cash',             icon: Cash01Icon },
  { id: 'cash-2',         name: 'Cash 2',           icon: Cash02Icon },
  { id: 'cashier',        name: 'Cashier',          icon: CashierIcon },
  { id: 'wallet',         name: 'Wallet',           icon: Wallet01Icon },
  { id: 'credit-card',    name: 'Credit Card',      icon: CreditCardIcon },
  { id: 'gift-card',      name: 'Gift Card',        icon: GiftCardIcon },
  { id: 'bank',           name: 'Bank',             icon: BankIcon },
  { id: 'banknote',       name: 'Banknote',         icon: BanknoteIcon },
  { id: 'piggy-bank',     name: 'Piggy Bank',       icon: PiggyBankIcon },
  { id: 'savings',        name: 'Savings',          icon: SavingsIcon },
  { id: 'safe',           name: 'Safe',             icon: SafeIcon },
  { id: 'invoice',        name: 'Invoice',          icon: Invoice01Icon },
  { id: 'calculator',     name: 'Calculator',       icon: Calculator01Icon },
  { id: 'percent-circle', name: 'Percent Circle',   icon: PercentCircleIcon },
  { id: 'percent',        name: 'Percent',          icon: PercentIcon },
  { id: 'taxes',          name: 'Taxes',            icon: TaxesIcon },
  { id: 'diamond',        name: 'Diamond',          icon: DiamondIcon },
  // Exchange, charts & trading
  { id: 'money-exchange', name: 'Money Exchange',   icon: MoneyExchange01Icon },
  { id: 'exchange-dollar',name: 'Exchange Dollar',  icon: ExchangeDollarIcon },
  { id: 'analytics',      name: 'Analytics',        icon: Analytics01Icon },
  { id: 'chart-line',     name: 'Line Chart',       icon: ChartLineData01Icon },
  { id: 'chart-up',       name: 'Chart Up',         icon: ChartUpIcon },
  { id: 'chart-increase', name: 'Chart Increase',   icon: ChartIncreaseIcon },
  { id: 'chart-decrease', name: 'Chart Decrease',   icon: ChartDecreaseIcon },
  { id: 'analytics-up',   name: 'Analytics Up',     icon: AnalyticsUpIcon },
  { id: 'trade-up',       name: 'Trade Up',         icon: TradeUpIcon },
  { id: 'trade-down',     name: 'Trade Down',       icon: TradeDownIcon },
  { id: 'sale-tag',       name: 'Sale Tag',         icon: SaleTag01Icon },
  { id: 'banknote-up',    name: 'Banknote Up',      icon: BanknoteArrowUpIcon },
  // Crypto
  { id: 'bitcoin',        name: 'Bitcoin',          icon: Bitcoin01Icon },
  { id: 'bitcoin-wallet', name: 'Bitcoin Wallet',   icon: BitcoinWalletIcon },
  { id: 'bitcoin-circle', name: 'Bitcoin Circle',   icon: BitcoinCircleIcon },
  // AI
  { id: 'ai-brain',       name: 'AI Brain',         icon: AiBrain01Icon },
  { id: 'ai-chat',        name: 'AI Chat',          icon: AiChat01Icon },
  { id: 'ai-magic',       name: 'AI Magic',         icon: AiMagicIcon },
  { id: 'ai-idea',        name: 'AI Idea',          icon: AiIdeaIcon },
  { id: 'ai-network',     name: 'AI Network',       icon: AiNetworkIcon },
  { id: 'chip',           name: 'Chip',             icon: ChipIcon },
];

export const DEFAULT_LOGO_ID = 'coins';

/** Render an app logo by id. Falls back to the default if id is unknown. */
export function Logo({ id, size = 22, strokeWidth = 1.8, style }) {
  const logo = LOGOS.find((l) => l.id === id) || LOGOS[0];
  return (
    <HugeiconsIcon
      icon={logo.icon}
      size={size}
      color="currentColor"
      strokeWidth={strokeWidth}
      style={style}
    />
  );
}
