import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { ApiErrorCode } from '@colanode/core';
import { acceptPageInvitation } from '@colanode/server/lib/page-invitations';

export const pageInvitationAcceptRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.post(
    '/page-invitations/accept',
    {
      schema: {
        body: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const accepted = await acceptPageInvitation(
        request.account.id,
        request.body.token
      );
      if (!accepted) {
        return reply.code(404).send({
          code: ApiErrorCode.NotFound,
          message: 'This invitation has expired or is for a different account.',
        });
      }
      return { workspaceId: accepted.workspaceId, pageId: accepted.pageId };
    }
  );
  done();
};
