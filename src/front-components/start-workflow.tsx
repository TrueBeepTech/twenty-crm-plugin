import { useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { closeSidePanel, enqueueSnackbar, useSelectedObjectMetadata, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { LightButton, MainButton } from 'twenty-ui/components/input';
import { Banner, Loader } from 'twenty-ui/primitives/feedback';
import { Text } from 'twenty-ui/primitives/typography';
import { useTheme } from 'twenty-ui/theme';

import { TRUEBEEP_START_WORKFLOW_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getRoute, isFailure, postRoute } from 'src/front-components/shared/call-route';
import type { SendOutcome } from 'src/lib/truebeep-types';
import type { StartableWorkflow } from 'src/logic-functions/workflow-routes';

const MAX = 25;

const StartWorkflow = () => {
  const theme = useTheme();
  const selectedIds = useSelectedRecordIds();
  const isDeal = useSelectedObjectMetadata()?.nameSingular === 'opportunity';
  const ids = useMemo(() => selectedIds.slice(0, MAX), [selectedIds]);
  const [workflows, setWorkflows] = useState<StartableWorkflow[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<SendOutcome[] | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await getRoute<{ status: 'ok'; workflows: StartableWorkflow[] }>('workflows');
      if (isFailure(res)) setProblem(res.message);
      else setWorkflows(res.workflows);
    })();
  }, []);

  const run = async () => {
    if (!picked) return;
    setRunning(true);
    const res = await postRoute<{ status: 'ok'; outcomes: SendOutcome[] }>('run-workflow', {
      workflowId: picked,
      personIds: isDeal ? [] : ids,
      opportunityIds: isDeal ? ids : [],
    });
    setRunning(false);
    if (isFailure(res)) {
      setProblem(res.message);
      return;
    }
    setOutcomes(res.outcomes);
    const ok = res.outcomes.filter((o) => o.ok).length;
    await enqueueSnackbar({ message: `Started for ${ok} of ${res.outcomes.length}`, variant: ok ? 'success' : 'warning' });
  };

  const column = { display: 'flex', flexDirection: 'column' as const, gap: theme.spacing[3], padding: theme.spacing[4] };

  if (outcomes) {
    return (
      <div style={column} data-testid="truebeep-start-workflow">
        {outcomes.map((o) => (
          <div key={o.personId}>
            <Text size="sm" weight="medium">
              {o.ok ? '✓' : '✕'} {o.name}
            </Text>
            <Text size="sm" color="tertiary">
              {o.message}
            </Text>
          </div>
        ))}
        <LightButton onClick={() => void closeSidePanel()} data-testid="truebeep-start-workflow-close">
          Close
        </LightButton>
      </div>
    );
  }

  return (
    <div style={column} data-testid="truebeep-start-workflow">
      <Text weight="semibold">Start a TrueBeep workflow</Text>
      {selectedIds.length > MAX && (
        <Banner status="warning" variant="soft">
          Only the first {MAX} selected will be started.
        </Banner>
      )}
      {problem && (
        <Banner status="error" variant="soft">
          {problem}
        </Banner>
      )}
      {workflows === null && !problem ? (
        <Loader />
      ) : workflows?.length === 0 ? (
        <Text size="sm" color="secondary">
          No workflows can be started from Twenty yet. In TrueBeep, set a workflow’s trigger to “Started from the API or
          Twenty” and publish it.
        </Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }}>
          {workflows?.map((w) => (
            <LightButton
              key={w.id}
              variant={picked === w.id ? 'soft' : 'ghost'} aria-pressed={picked === w.id}
              onClick={() => setPicked(w.id)}
              data-testid={`truebeep-start-workflow-option-${w.id}`}
            >
              {w.name}
            </LightButton>
          ))}
        </div>
      )}
      <MainButton onClick={() => void run()} disabled={!picked || running} loading={running} data-testid="truebeep-start-workflow-submit">
        Start for {ids.length} {ids.length === 1 ? (isDeal ? 'deal' : 'person') : isDeal ? 'deals' : 'people'}
      </MainButton>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: TRUEBEEP_START_WORKFLOW_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Start TrueBeep workflow',
  description: 'Start a TrueBeep workflow for the selected people or deals',
  component: StartWorkflow,
});
