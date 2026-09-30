import { defineView } from '@objectstack/spec';

/** Field order and groups remain on the customer object; the form sets layout. */
export const CustomerViews = defineView({
  object: 'forge_customer',
  form: {
    type: 'simple',
    data: { provider: 'object', object: 'forge_customer' },
    columns: 2,
  },
});
