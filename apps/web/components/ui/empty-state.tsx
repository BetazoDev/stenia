import type { ReactNode } from 'react';

import { Card } from './card';

type EmptyStateProps = { title: string; description: string; action?: ReactNode };

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-start gap-3 py-8">
      <h2 className="text-2xl">{title}</h2>
      <p className="max-w-prose text-text-2">{description}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </Card>
  );
}
