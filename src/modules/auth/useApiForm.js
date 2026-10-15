// react-hook-form + zod, with API field errors (422 details) mapped back
// onto the matching inputs and everything else returned as a form message.
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export function useApiForm(schema, options = {}) {
  const form = useForm({ resolver: zodResolver(schema), mode: 'onTouched', ...options });
  const [formError, setFormError] = useState(null);

  const submit = (fn) => form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await fn(values);
    } catch (e) {
      const fields = e.fieldErrors || {};
      const known = Object.keys(fields).filter((k) => k in form.getValues());
      known.forEach((k) => form.setError(k, { type: 'server', message: fields[k] }));
      if (!known.length) setFormError(e);
    }
  });

  return { ...form, submit, formError, setFormError, errorOf: (name) => form.formState.errors[name]?.message };
}
