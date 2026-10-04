import { useEffect, useId, useState, type FormEvent } from 'react';

import { errorMessage } from '../lib/api';
import { formatMoney } from '../lib/format';
import { useMoneyMovement } from '../lib/queries';
import type { Account } from '../lib/types';
import { AccountDot } from './AccountCard';
import { AmountInput, isPositiveAmount, QuickAmounts } from './AmountInput';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { Alert, Button, Field, Input, Select } from './ui';

interface MoneyModalProps {
  kind: 'deposit' | 'withdraw' | null;
  accounts: Account[];
  defaultAccountId?: string;
  onClose: () => void;
}

/** Deposit or withdraw dialog; the user can pick which account if there are several. */
export function MoneyModal({ kind, accounts, defaultAccountId, onClose }: MoneyModalProps) {
  const formId = useId();
  const toast = useToast();
  const usable = accounts.filter((account) => account.status === 'ACTIVE');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const deposit = useMoneyMovement('deposit');
  const withdraw = useMoneyMovement('withdraw');
  const mutation = kind === 'withdraw' ? withdraw : deposit;

  useEffect(() => {
    if (!kind) return;
    setAccountId(defaultAccountId ?? usable[0]?.id ?? '');
    setAmount('');
    setDescription('');
    deposit.reset();
    withdraw.reset();
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const account = usable.find((item) => item.id === accountId);
  const insufficient = kind === 'withdraw' && account && Number.parseFloat(amount || '0') > Number.parseFloat(account.balance);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!account || !isPositiveAmount(amount) || insufficient) return;
    try {
      const result = await mutation.mutateAsync({ accountId: account.id, amount, description });
      toast.success(
        kind === 'deposit' ? 'Deposit complete' : 'Withdrawal complete',
        `${formatMoney(amount, account.currency)} · New balance ${formatMoney(result.account.balance, account.currency)}`,
      );
      onClose();
    } catch {
      // Error is shown inside the dialog.
    }
  };

  const verb = kind === 'deposit' ? 'Deposit' : 'Withdraw';

  return (
    <Modal
      open={kind !== null}
      onClose={onClose}
      title={kind === 'deposit' ? 'Deposit money' : 'Withdraw money'}
      description={kind === 'deposit' ? 'Simulated cash deposit — funds are available instantly.' : 'Simulated cash withdrawal from your account.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending} disabled={!account || !isPositiveAmount(amount) || Boolean(insufficient)}>
            {verb} {isPositiveAmount(amount) && account ? formatMoney(amount, account.currency) : ''}
          </Button>
        </>
      }
    >
      {usable.length === 0 ? (
        <Alert tone="warning">You have no active accounts. Open an account first.</Alert>
      ) : (
        <form id={formId} onSubmit={submit} className="stack">
          {mutation.isError && <Alert>{errorMessage(mutation.error)}</Alert>}
          <Field label="Account" htmlFor={`${formId}-account`}>
            {usable.length > 1 ? (
              <Select id={`${formId}-account`} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {usable.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {formatMoney(item.balance, item.currency)}
                  </option>
                ))}
              </Select>
            ) : (
              account && (
                <div className="row">
                  <AccountDot account={account} />
                  <div>
                    <div className="strong">{account.name}</div>
                    <div className="small muted">Balance {formatMoney(account.balance, account.currency)}</div>
                  </div>
                </div>
              )
            )}
          </Field>
          {account && (
            <Field label="Amount" error={insufficient ? `Insufficient funds — available ${formatMoney(account.balance, account.currency)}` : undefined}>
              <AmountInput value={amount} onChange={setAmount} currency={account.currency} invalid={Boolean(insufficient)} />
              <QuickAmounts currency={account.currency} onPick={setAmount} />
            </Field>
          )}
          <Field label="Note" hint="Optional — shown in your activity" htmlFor={`${formId}-note`}>
            <Input id={`${formId}-note`} value={description} maxLength={140} onChange={(event) => setDescription(event.target.value)} placeholder={kind === 'deposit' ? 'e.g. Cash deposit' : 'e.g. ATM withdrawal'} />
          </Field>
        </form>
      )}
    </Modal>
  );
}
