'use client';

import { Landmark, ShieldCheck, AlertTriangle, Coins, X, HandCoins, TrendingUp } from 'lucide-react';
import { BANK_LOAN_OPTIONS, BANK_SHOP, formatMoney, getBankLoanEligibility } from '@/lib/game/constants';
import type { WorldSave } from '@/lib/game/types';

interface BankModalProps {
  world: WorldSave;
  onTakeLoan: (optionId: 'starter_10' | 'business_50' | 'business_100' | 'business_200') => void;
  onRepayLoan: (amountCents?: number) => void;
  onClose: () => void;
}

export default function BankModal({
  world,
  onTakeLoan,
  onRepayLoan,
  onClose,
}: BankModalProps) {
  const activeLoan = world.activeLoan?.status === 'active' ? world.activeLoan : null;
  const eligibility = getBankLoanEligibility(world);
  const lastDayRevenue = world.lastDayRevenueCents ?? 0;
  const canRepay = Boolean(activeLoan && world.cashCents > 0 && activeLoan.remainingDueCents > 0);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[calc(100vh-2rem)] rounded-xl bg-[#2A201B] border border-[#60A5FA]/35 shadow-2xl text-[#FFFDF9] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#1E293B] border-b border-[#60A5FA]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">{BANK_SHOP.shopName}</h2>
              <p className="text-xs text-[#BFDBFE]">
                {BANK_SHOP.bankerName}: Daily revenue dekh kar loan approve hota hai. Cash: <span className="font-mono font-bold text-[#FBBF24]">{formatMoney(world.cashCents)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bank"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#334155] hover:bg-[#475569] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-[#221915] border border-[#D4A373]/15 p-3">
              <div className="text-[11px] text-[#D6C7B5]">Last Day Revenue</div>
              <div className="font-mono font-bold text-lg text-[#86EFAC]">{formatMoney(lastDayRevenue)}</div>
            </div>
            <div className="rounded-lg bg-[#221915] border border-[#D4A373]/15 p-3">
              <div className="text-[11px] text-[#D6C7B5]">Max Loan Limit</div>
              <div className="font-mono font-bold text-lg text-[#93C5FD]">{formatMoney(eligibility.maxLoanCents)}</div>
            </div>
            <div className="rounded-lg bg-[#221915] border border-[#D4A373]/15 p-3">
              <div className="text-[11px] text-[#D6C7B5]">Player Status</div>
              <div className="font-semibold text-sm text-[#FDE68A]">{eligibility.freshPlayer ? 'Fresh / New Player' : 'Business Player'}</div>
            </div>
          </div>

          <div className="rounded-lg border border-[#60A5FA]/20 bg-[#1E293B]/40 p-3 text-sm text-[#DBEAFE] flex items-start gap-2">
            <TrendingUp className="w-4 h-4 mt-0.5 text-[#93C5FD] shrink-0" />
            <div>
              <div className="font-semibold">Bank Rule</div>
              <div className="text-xs text-[#BFDBFE] mt-0.5">{eligibility.reason}</div>
              <div className="text-[11px] text-[#93C5FD]/90 mt-1">Example: agar last day revenue $10 hai, to bank $20 tak ka loan de sakta hai.</div>
            </div>
          </div>

          {activeLoan ? (
            <div className="rounded-lg border border-[#F59E0B]/35 bg-[#3A2A1A] p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#FDE68A] font-semibold">
                <AlertTriangle className="w-4 h-4" />
                Active Loan: {activeLoan.label}
              </div>
              <div className="text-sm text-[#EAE0D0] grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>Principal: <span className="font-mono">{formatMoney(activeLoan.principalCents)}</span></div>
                <div>Interest: <span className="font-mono">{activeLoan.interestRatePercent}%</span></div>
                <div>Remaining: <span className="font-mono text-[#FCA5A5]">{formatMoney(activeLoan.remainingDueCents)}</span></div>
                <div>Due in: <span className="font-mono">{activeLoan.daysRemaining} day(s)</span></div>
              </div>
              <div className="text-xs text-[#D6C7B5]">
                Day end par due days kam honge. Due day par bank auto repayment try karega. Cash kam hua to loan default ho sakta hai.
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={!canRepay}
                  onClick={() => onRepayLoan(activeLoan.remainingDueCents)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                    canRepay ? 'bg-[#16A34A] hover:bg-[#15803D] text-white cursor-pointer' : 'bg-[#44403C] text-[#A8A29E] cursor-not-allowed'
                  }`}
                >
                  <HandCoins className="w-4 h-4" />
                  Repay Full
                </button>
                <button
                  type="button"
                  disabled={!canRepay}
                  onClick={() => onRepayLoan(Math.min(world.cashCents, Math.max(100, Math.floor(activeLoan.remainingDueCents / 2))))}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    canRepay ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer' : 'bg-[#44403C] text-[#A8A29E] cursor-not-allowed'
                  }`}
                >
                  Pay Partial
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#86EFAC]/25 bg-[#1F3A2A]/40 p-3 text-sm text-[#D6F5E3] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#86EFAC]" />
              Koi active loan nahi hai. Ek waqt me sirf 1 loan liya ja sakta hai.
            </div>
          )}

          <div className="space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-[#93C5FD]">Loan Options</div>
            {BANK_LOAN_OPTIONS.map((opt) => {
              const totalDue = Math.round(opt.principalCents * (1 + opt.interestRatePercent / 100));
              const isStarter = Boolean(opt.freshPlayerOnly);
              const lockedByActiveLoan = Boolean(activeLoan);
              const lockedByFresh = isStarter && !eligibility.freshPlayer;
              const lockedByRevenue = !isStarter && opt.principalCents > eligibility.maxLoanCents;
              const canTake = !lockedByActiveLoan && !lockedByFresh && !lockedByRevenue;

              let lockReason = '';
              if (lockedByActiveLoan) lockReason = 'Pehle active loan repay karo.';
              else if (lockedByFresh) lockReason = 'Ye sirf naye/fresh player ke liye hai.';
              else if (lockedByRevenue) lockReason = `Is loan ke liye zyada daily revenue chahiye. Aapki limit ${formatMoney(eligibility.maxLoanCents)} hai.`;

              return (
                <div key={opt.id} className={`rounded-lg border p-4 space-y-2 ${canTake ? 'border-[#60A5FA]/30 bg-[#221915]' : 'border-[#78716C]/25 bg-[#201A16]/80 opacity-90'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display font-bold text-sm">{opt.name}</div>
                      <div className="text-xs text-[#D6C7B5]">{opt.description}</div>
                    </div>
                    <div className="text-right text-xs font-mono text-[#FDE68A]">
                      <div>+{formatMoney(opt.principalCents)}</div>
                      <div className="text-[#FCA5A5]">Wapas {formatMoney(totalDue)}</div>
                    </div>
                  </div>
                  <div className="text-xs text-[#EAE0D0] grid grid-cols-3 gap-2">
                    <div>Interest: <span className="font-mono">{opt.interestRatePercent}%</span></div>
                    <div>Duration: <span className="font-mono">{opt.daysToRepay} din</span></div>
                    <div>Type: <span className="font-mono">{isStarter ? 'Starter' : 'Business'}</span></div>
                  </div>

                  {!canTake && lockReason && (
                    <div className="text-[11px] text-[#FCD34D] bg-[#78350F]/25 border border-[#F59E0B]/20 rounded px-2 py-1">
                      {lockReason}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!canTake}
                    onClick={() => onTakeLoan(opt.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                      canTake
                        ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer'
                        : 'bg-[#44403C] text-[#A8A29E] cursor-not-allowed'
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                    {canTake ? 'Take Loan' : 'Locked'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-[#D6C7B5] bg-[#1B1410] border border-[#D4A373]/15 rounded-lg p-3">
            Terms: Ek waqt me sirf 1 active loan. Bank last day revenue dekh kar business loan limit set karta hai. Day end par due days kam hote hain; due day par auto deduction hoti hai. Cash kam hua to loan default ho sakta hai.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#60A5FA]/20 bg-[#1E293B]/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#334155] hover:bg-[#475569] text-sm font-semibold cursor-pointer"
          >
            Close Bank
          </button>
        </div>
      </div>
    </div>
  );
}
