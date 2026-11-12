import { Avatar } from '@colanode/ui/components/avatars/avatar';

export const PageLinkContent = ({
  id,
  name,
  avatar,
}: {
  id: string;
  name: string;
  avatar?: string | null;
}) => (
  <div className="my-0.5 flex min-h-10 w-full cursor-pointer flex-row items-center gap-1 rounded-md p-1 hover:bg-accent">
    <Avatar size="small" id={id} name={name} avatar={avatar ?? null} />
    <div role="presentation" className="min-w-0 grow wrap-anywhere">
      {name}
    </div>
  </div>
);
