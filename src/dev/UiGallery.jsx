// Development-only gallery (/dev/ui): every token and UI kit component in all
// variants and states. The mobile app mirrors this screen for a side-by-side check.
import { useState } from 'react';
import { BadgeCheck, Plus, Search, Trash2 } from 'lucide-react';
import tokens from '@/design/tokens.json';
import {
  Alert, Avatar, Badge, Button, Card, CardHeader, Checkbox, EmptyState, Input, Modal, OtpInput, PageHeader, Pagination,
  PasswordInput, Select, Skeleton, Spinner, Stat, Stepper, Table, Tabs, Textarea, useToast,
} from '@/shared/ui';
import { rupees, shortRupees } from '@/shared/lib/format';

function Section({ title, children }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function UiGallery() {
  const toast = useToast();
  const [tab, setTab] = useState('a');
  const [otp, setOtp] = useState('12');
  const [modal, setModal] = useState(false);
  const [page, setPage] = useState(2);
  const scales = Object.entries(tokens.color).filter(([, v]) => typeof v === 'object');

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
      <PageHeader title="Design system" description="Tokens from design/tokens.json and the shared UI kit. Development only." />

      <Section title="Colour tokens">
        <div className="space-y-3">
          {scales.map(([name, scale]) => (
            <div key={name} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-sm font-medium text-ink">{name}</span>
              {Object.entries(scale).map(([k, v]) => (
                <div key={k} className="text-center">
                  <div className="h-10 w-14 rounded-md border" style={{ background: v }} />
                  <span className="text-[10px] text-ink-subtle">{k}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        {Object.keys(tokens.font.size).reverse().map((k) => <p key={k} className={`text-${k} text-ink`}>text-{k} · Verified homes directly from owners</p>)}
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          {['primary', 'secondary', 'accent', 'ghost', 'danger', 'link'].map((v) => <Button key={v} variant={v}>{v}</Button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" icon={Plus}>Small</Button>
          <Button icon={Search}>Medium</Button>
          <Button size="lg">Large</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="danger" icon={Trash2}>Delete</Button>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" placeholder="Asha Sharma" required />
          <Input label="With error" defaultValue="abc" error="Enter a valid email" />
          <Input label="Price" leading="₹" hint="Rupees, no decimals" />
          <PasswordInput hint="8+ characters, a letter and a digit" />
          <Select label="City" placeholder="Choose a city" options={[{ value: 'pune', label: 'Pune' }, { value: 'mumbai', label: 'Mumbai' }]} />
          <Input label="Disabled" disabled value="Read only" readOnly />
          <Textarea label="Description" className="sm:col-span-2" />
          <Checkbox label="I am not a broker" description="Brokers cannot list on this platform." />
          <div><p className="mb-1.5 text-sm font-medium">OTP input</p><OtpInput value={otp} onChange={setOtp} /></div>
        </div>
      </Section>

      <Section title="Badges, alerts and feedback">
        <div className="flex flex-wrap gap-2">
          {['neutral', 'brand', 'success', 'warning', 'danger', 'info', 'accent'].map((t) => <Badge key={t} tone={t}>{t}</Badge>)}
          <Badge tone="success" icon={BadgeCheck}>Photo verified</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Alert tone="info" title="Heads up">Listings expire after 90 days.</Alert>
          <Alert tone="success">Listing approved and live.</Alert>
          <Alert tone="warning" title="Still available?">Answer within 7 days or the listing pauses.</Alert>
          <Alert tone="danger">Contact details are not allowed in descriptions.</Alert>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Spinner /><Avatar name="Asha Sharma" /><Avatar name="Ravi Kumar" size="lg" />
          <Button variant="secondary" onClick={() => toast.success('Saved successfully')}>Success toast</Button>
          <Button variant="secondary" onClick={() => toast.error('Could not save, try again')}>Error toast</Button>
          <Button variant="secondary" onClick={() => setModal(true)}>Open modal</Button>
        </div>
        <Modal open={modal} onClose={() => setModal(false)} title="Accept commission agreement" description="Read the agreement before accepting."
          footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button onClick={() => setModal(false)}>Accept</Button></>}>
          <p className="text-sm text-ink-muted">Commission 2.00% of the agreed sale price plus GST, payable on a verified deal.</p>
        </Modal>
      </Section>

      <Section title="Cards and data">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Live listings" value="128" hint="+12 this week" icon={BadgeCheck} />
          <Stat label="Commission due" value={shortRupees(4560000000)} tone="accent" icon={BadgeCheck} />
          <Card><CardHeader title="Card" description="With header" /><Skeleton className="h-4 w-3/4" /><Skeleton className="mt-2 h-4 w-1/2" /></Card>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'a', label: 'Live', count: 12 }, { value: 'b', label: 'Pending', count: 3 }, { value: 'c', label: 'Paused' }]} />
        <Table rowKey={(r) => r.no} rows={[{ no: 'RE26-000001', city: 'Pune', price: 850000000 }, { no: 'RE26-000002', city: 'Mumbai', price: 1250000000 }]}
          columns={[{ key: 'no', header: 'Listing' }, { key: 'city', header: 'City' }, { key: 'price', header: 'Price', render: (r) => rupees(r.price) }]} />
        <Pagination page={page} pages={5} onChange={setPage} />
        <Stepper steps={[{ label: 'Basic' }, { label: 'Location' }, { label: 'Details' }, { label: 'Price' }]} current={2} />
        <EmptyState icon={Search} title="No properties match" description="Try a wider budget or another locality." action={<Button variant="secondary">Request a property</Button>} />
      </Section>
    </div>
  );
}
