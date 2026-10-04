import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Check, Hash, Loader2, Send, UserRound } from 'lucide-react';

import { AccountDot } from '../components/AccountCard';
import { AmountInput, isPositiveAmount, QuickAmounts } from '../components/AmountInput';
import { Alert, Avatar, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Segmented, Skeleton } from '../components/ui';
import { ApiError, errorMessage } from '../lib/api';
import { describeTransaction, formatAccountNumber, formatDateTime, formatMoney, maskAccountNumber } from '../lib/format';
import { lookupAccount, useAccounts, useTransfer } from '../lib/queries';
import type { Account, RecipientPreview, TransferResult } from '../lib/types';

type Mode = 'own' | 'external';

/** Seeded demo customers, offered as one-click recipients. */
const DEMO_RECIPIENTS = [
  { name: 'Sam Lee', accountNumber: '4000987654321098' },
  { name: 'Alex Carter', accountNumber: '4000123456789012' },
];

function AccountOption({ account, selected, disabled, onSelect }: { account: Account; selected: boolean; disabled?: boolean; onSelect: () => void }) {
  return (
    <button type="button" className="account-option" aria-pressed={selected} disabled={disabled} onClick={onSelect}>
      <AccountDot account={account} />
      <div className="grow">
        <div className="strong ellipsis">{account.name}</div>
        <div className="small muted num ellipsis">
          {formatMoney(account.balance, account.currency)} · {maskAccountNumber(account.accountNumber)}
        </div>
      </div>
      {selected && <Check size={18} color="var(--primary)" />}
    </button>
  );
}

/** Looks up a 16-digit account number as the user types, with a short debounce. */
function useRecipientLookup(rawNumber: string) {
  const digits = rawNumber.replace(/\D/g, '');
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'found' | 'error'; recipient?: RecipientPreview; error?: string }>({ status: 'idle' });

  useEffect(() => {
    if (digits.length !== 16) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    const timer = window.setTimeout(async () => {
      try {
        const recipient = await lookupAccount(digits);
        if (!cancelled) setState({ status: 'found', recipient });
      } catch (error) {
        if (!cancelled) setState({ status: 'error', error: error instanceof ApiError && error.status === 404 ? 'No account found with this number' : errorMessage(error) });
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [digits]);

  return { digits, ...state };
}

function SuccessView({ result, onReset }: { result: TransferResult; onReset: () => void }) {
  const { transaction } = result;
  const to = transaction.destination;
  return (
    <Card className="card-pad" >
      <div className="stack" style={{ maxWidth: 440, margin: '0 auto', padding: '12px 0' }}>
        <div className="receipt">
          <span className="success-mark"><Check /></span>
          <h2 style={{ fontSize: 22 }}>Money sent</h2>
          <div className="receipt-amount">{formatMoney(transaction.amount, transaction.currency)}</div>
          <p className="muted">{describeTransaction(transaction).title}</p>
        </div>
        <div className="receipt-rows">
          <div className="receipt-row"><span>To</span><span>{to?.isOwn ? to.accountName : to?.ownerName} · {maskAccountNumber(to?.accountNumber ?? '')}</span></div>
          <div className="receipt-row"><span>From</span><span>{result.sourceAccount.name}</span></div>
          <div className="receipt-row"><span>New balance</span><span className="num">{formatMoney(result.sourceAccount.balance, result.sourceAccount.currency)}</span></div>
          <div className="receipt-row"><span>Date</span><span>{formatDateTime(transaction.createdAt)}</span></div>
          <div className="receipt-row"><span>Reference</span><span className="mono">{transaction.reference}</span></div>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Button onClick={onReset} icon={<Send />}>Send another</Button>
          <Link to="/app/transactions" className="btn btn-secondary">View activity</Link>
        </div>
      </div>
    </Card>
  );
}

export default function TransferPage() {
  const [searchParams] = useSearchParams();
  const accounts = useAccounts();
  const transfer = useTransfer();
  const usable = useMemo(() => (accounts.data ?? []).filter((account) => account.status === 'ACTIVE'), [accounts.data]);

  const [mode, setMode] = useState<Mode>('external');
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<TransferResult | null>(null);
  const lookup = useRecipientLookup(accountNumber);

  useEffect(() => {
    if (sourceId || usable.length === 0) return;
    const requested = searchParams.get('from');
    setSourceId(usable.find((account) => account.id === requested)?.id ?? usable[0]!.id);
  }, [usable, sourceId, searchParams]);

  const source = usable.find((account) => account.id === sourceId);
  const ownNumbers = new Set((accounts.data ?? []).map((account) => account.accountNumber));
  const demoRecipients = DEMO_RECIPIENTS.filter((recipient) => !ownNumbers.has(recipient.accountNumber));
  const ownTargets = usable.filter((account) => account.id !== sourceId);
  const destination = ownTargets.find((account) => account.id === destinationId);

  useEffect(() => {
    // Keep the destination valid when the source changes.
    if (destinationId && !ownTargets.some((account) => account.id === destinationId && account.currency === source?.currency)) setDestinationId('');
  }, [sourceId, ownTargets, destinationId, source?.currency]);

  const amountValue = Number.parseFloat(amount || '0');
  const insufficient = source ? amountValue > Number.parseFloat(source.balance) : false;

  let recipientError = '';
  if (mode === 'external' && lookup.status === 'found' && lookup.recipient && source) {
    if (lookup.recipient.accountNumber === source.accountNumber) recipientError = 'You cannot send money to the same account';
    else if (!lookup.recipient.canReceive) recipientError = 'This account cannot receive transfers right now';
    else if (lookup.recipient.currency !== source.currency) recipientError = `This is a ${lookup.recipient.currency} account — choose a ${lookup.recipient.currency} source account`;
  }

  const recipientReady = mode === 'own' ? Boolean(destination) : lookup.status === 'found' && !recipientError;
  const canSubmit = Boolean(source) && recipientReady && isPositiveAmount(amount) && !insufficient && !transfer.isPending;

  const recipientName =
    mode === 'own' ? destination?.name : lookup.recipient ? `${lookup.recipient.ownerName}${lookup.recipient.isOwn ? ' (you)' : ''}` : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !source) return;
    try {
      const response = await transfer.mutateAsync({
        sourceAccountId: source.id,
        ...(mode === 'own' ? { destinationAccountId: destinationId } : { destinationAccountNumber: lookup.digits }),
        amount,
        description: description.trim() || undefined,
      });
      setResult(response);
    } catch {
      // Shown in the form.
    }
  };

  const reset = () => {
    setResult(null);
    setAmount('');
    setDescription('');
    setAccountNumber('');
    setDestinationId('');
    transfer.reset();
  };

  if (result) {
    return (
      <>
        <PageHeader title="Send money" />
        <SuccessView result={result} onReset={reset} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Send money" subtitle="Transfers between Ledgerly accounts arrive instantly." />

      {!accounts.isLoading && usable.length === 0 ? (
        <Card>
          <EmptyState title="No active accounts" action={<Link to="/app/accounts" className="btn btn-primary">Go to accounts</Link>}>
            Open an account before sending money.
          </EmptyState>
        </Card>
      ) : (
        <form className="transfer-layout" onSubmit={submit}>
          <div className="stack">
            <Card>
              <CardHeader title="1. From" subtitle="Choose the account to send from." />
              <div className="card-body">
                {accounts.isLoading ? (
                  <Skeleton height={64} radius={14} />
                ) : (
                  <div className="account-options">
                    {usable.map((account) => (
                      <AccountOption key={account.id} account={account} selected={account.id === sourceId} onSelect={() => setSourceId(account.id)} />
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="2. To"
                subtitle={mode === 'own' ? 'Move money between your accounts.' : 'Enter the recipient’s 16-digit account number.'}
                action={
                  <Segmented
                    label="Recipient type"
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: 'external', label: <><UserRound /> <span className="hide-sm">Someone else</span></> },
                      { value: 'own', label: <><ArrowLeftRight /> <span className="hide-sm">My accounts</span></> },
                    ]}
                  />
                }
              />
              <div className="card-body stack">
                {mode === 'own' ? (
                  ownTargets.length === 0 ? (
                    <Alert tone="info">You need a second account to move money between your own accounts.</Alert>
                  ) : (
                    <div className="account-options">
                      {ownTargets.map((account) => (
                        <AccountOption
                          key={account.id}
                          account={account}
                          selected={account.id === destinationId}
                          disabled={account.currency !== source?.currency}
                          onSelect={() => setDestinationId(account.id)}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <>
                    <Field label="Account number" htmlFor="account-number" error={lookup.status === 'error' ? lookup.error : recipientError || undefined}>
                      <Input
                        id="account-number"
                        inputMode="numeric"
                        autoComplete="off"
                        icon={<Hash />}
                        placeholder="4000 0000 0000 0000"
                        value={formatAccountNumber(accountNumber)}
                        onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 16))}
                        invalid={lookup.status === 'error' || Boolean(recipientError)}
                        action={lookup.status === 'loading' ? <Loader2 size={18} className="spin" style={{ animation: 'spin 0.8s linear infinite', marginRight: 8 }} /> : undefined}
                      />
                    </Field>
                    {demoRecipients.length > 0 && lookup.status === 'idle' && (
                      <div className="stack-sm">
                        <span className="field-hint">Demo recipients</span>
                        <div className="chips">
                          {demoRecipients.map((recipient) => (
                            <button key={recipient.accountNumber} type="button" className="chip" onClick={() => setAccountNumber(recipient.accountNumber)}>
                              {recipient.name} · {maskAccountNumber(recipient.accountNumber)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {lookup.status === 'found' && lookup.recipient && !recipientError && (
                      <div className="recipient-preview">
                        <Avatar name={lookup.recipient.ownerName} />
                        <div className="grow">
                          <div className="strong">{lookup.recipient.ownerName}{lookup.recipient.isOwn ? ' (you)' : ''}</div>
                          <div className="small muted">{lookup.recipient.currency} account · {maskAccountNumber(lookup.recipient.accountNumber)}</div>
                        </div>
                        <Check size={20} color="var(--success)" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="3. Amount" />
              <div className="card-body stack">
                {source && (
                  <Field error={insufficient ? `Insufficient funds — available ${formatMoney(source.balance, source.currency)}` : undefined}>
                    <AmountInput value={amount} onChange={setAmount} currency={source.currency} invalid={insufficient} />
                    <QuickAmounts currency={source.currency} onPick={setAmount} />
                  </Field>
                )}
                <Field label="Note" hint="Optional — the recipient will see it" htmlFor="transfer-note">
                  <Input id="transfer-note" value={description} maxLength={140} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Dinner split" />
                </Field>
              </div>
            </Card>
          </div>

          <Card className="card-pad summary-card">
            <h2 className="card-title" style={{ marginBottom: 10 }}>Summary</h2>
            <div className="summary-row"><span>From</span><span>{source?.name ?? '—'}</span></div>
            <div className="summary-row"><span>To</span><span>{recipientReady ? recipientName : '—'}</span></div>
            <div className="summary-row"><span>Fee</span><span className="positive">Free</span></div>
            <div className="summary-row"><span>Arrives</span><span>Instantly</span></div>
            <div className="summary-total">
              <span className="muted strong">Total</span>
              <strong>{source ? formatMoney(amountValue, source.currency) : '—'}</strong>
            </div>
            {transfer.isError && (
              <div style={{ marginBottom: 12 }}>
                <Alert>{errorMessage(transfer.error)}</Alert>
              </div>
            )}
            <Button type="submit" size="lg" block icon={<Send />} loading={transfer.isPending} disabled={!canSubmit}>
              Send {isPositiveAmount(amount) && source ? formatMoney(amountValue, source.currency) : 'money'}
            </Button>
            {source && <p className="tiny faint" style={{ marginTop: 10, textAlign: 'center' }}>Balance after transfer: {formatMoney(Number.parseFloat(source.balance) - amountValue, source.currency)}</p>}
          </Card>
        </form>
      )}
    </>
  );
}
