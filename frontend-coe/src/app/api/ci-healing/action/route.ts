import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from 'env';

const ActionSchema = z.object({
  runId: z.string().uuid(),
  action: z.enum(['approve', 'deny', 'abort', 'human-fix']),
  note: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = ActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action payload',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const apiUrl = `${env.NEXT_PUBLIC_BACKEND_API_URL}/ci-healing/runs/${parsed.data.runId}/actions/${parsed.data.action}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note: parsed.data.note }),
      cache: 'no-store',
    });

    const payload = (await response.json()) as unknown;

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Backend action call failed',
          payload,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown action error',
      },
      { status: 500 },
    );
  }
}
