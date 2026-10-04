import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiggyBank, Wallet } from 'lucide-react';

import { errorMessage } from '../lib/api';
import { useCreateAccount } from '../lib/queries';
import { CURRENCIES, type AccountType, type Currency } from '../lib/types';
import { AccountCard } from './AccountCard';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { Alert, Button, Field, Input, Segmented } from './ui';

const CURRENCY_NAMES: Record<Currency, string> = { USD: 'US Dollar', EUR: 'Euro', AMD: 'Armenian Dram' };

export function NewAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const formId = useId();
  const toast = useToast();
  const navigate = useNavigate();
  const createAccount = useCreateAccount();
  const [type, setType] = useState<AccountType>('CHECKING');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    setType('CHECKING');
    setCurrency('USD');
    setName('');
    createAccount.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const defaultName = `${type === 'SAVINGS' ? 'Savings' : 'Checking'} · ${currency}`;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const account = await createAccount.mutateAsync({ type, currency, name: name.trim() || undefined });
      toast.success('Account opened', `${account.name} is ready to use.`);
      onClose();
      navigate(`/app/accounts/${account.id}`);
    } catch {
      // Shown inline.
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open a new account"
      description="Accounts open instantly with no fees."
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={createAccount.isPending}>
            Open account
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="stack">
        {createAccount.isError && <Alert>{errorMessage(createAccount.error)}</Alert>}
        <AccountCard
          link={false}
          account={{
            id: 'preview',
            accountNumber: '4000000000000000',
            name: name.trim() || defaultName,
            type,
            currency,
            balance: '0',
            status: 'ACTIVE',
            createdAt: '',
            updatedAt: '',
            closedAt: null,
          }}
        />
        <Field label="Account type">
          <Segmented
            full
            label="Account type"
            value={type}
            onChange={setType}
            options={[
              { value: 'CHECKING', label: <><Wallet /> Checking</> },
              { value: 'SAVINGS', label: <><PiggyBank /> Savings</> },
            ]}
          />
        </Field>
        <Field label="Currency">
          <Segmented
            full
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={CURRENCIES.map((code) => ({ value: code, label: code }))}
          />
          <span className="field-hint">{CURRENCY_NAMES[currency]} — transfers only work between accounts in the same currency.</span>
        </Field>
        <Field label="Nickname" hint="Optional" htmlFor={`${formId}-name`}>
          <Input id={`${formId}-name`} value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder={defaultName} />
        </Field>
      </form>
    </Modal>
  );
}
