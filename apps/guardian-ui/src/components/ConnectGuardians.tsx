import React, { useCallback, useEffect, useMemo } from 'react';
import {
  FormControl,
  FormLabel,
  Flex,
  Button,
  FormHelperText,
  Spinner,
  TableContainer,
  Table as ChakraTable,
  Tbody,
  Tr,
  Td,
  Tag,
  Icon,
} from '@chakra-ui/react';
import { CopyInput, Table, TableRow } from '@fedimint/ui';
import { useTranslation } from '@fedimint/utils';
import { useConsensusPolling, useSetupContext } from '../hooks';
import { ModuleKind, ServerStatus } from '../types';
import { GuardianRole } from '../types';
import { getModuleParamsFromConfig } from '../utils/api';
import { ReactComponent as CopyIcon } from '../assets/svgs/copy.svg';

interface Props {
  next(): void;
}

export const ConnectGuardians: React.FC<Props> = ({ next }) => {
  const { t } = useTranslation();
  const {
    state: { role, peers, numPeers, configGenParams, ourCurrentId },
  } = useSetupContext();

  const guardianLink = ourCurrentId !== null ? peers[ourCurrentId].api_url : '';

  // Poll for peers and configGenParams while on this page.
  useConsensusPolling();

  const isAllConnected = numPeers && numPeers == peers.length;
  const isAllAccepted =
    isAllConnected &&
    peers.filter((peer) => peer.status === ServerStatus.ReadyForConfigGen)
      .length >=
      numPeers - 1;

  // For hosts, once all peers have connected, run DKG immediately.
  useEffect(() => {
    if (role !== GuardianRole.Host || !isAllAccepted) return;
    next();
  }, [role, isAllAccepted, next]);

  const handleApprove = useCallback(() => {
    next();
  }, [next]);

  let content: React.ReactNode;
  if (!configGenParams) {
    content = <Spinner />;
  } else if (role === GuardianRole.Host) {
    content = (
      <FormControl maxWidth={400}>
        <FormLabel>{t('connect-guardians.invite-guardians')}</FormLabel>
        <CopyInput
          value={guardianLink}
          size='lg'
          buttonLeftIcon={<Icon as={CopyIcon} />}
        />
        <FormHelperText>
          {t('connect-guardians.invite-guardians-help')}
        </FormHelperText>
      </FormControl>
    );
  } else {
    // TODO: Consider making this more dynamic, work with unknown modules etc.
    const rows: { label: string; value: React.ReactNode }[] = [
      {
        label: 'Federation name',
        value: configGenParams.meta?.federation_name,
      },
      {
        label: 'Network',
        value: getModuleParamsFromConfig(configGenParams, ModuleKind.Wallet)
          ?.consensus?.network,
      },
      {
        label: 'Block confirmations',
        value: getModuleParamsFromConfig(configGenParams, ModuleKind.Wallet)
          ?.consensus?.finality_delay,
      },
    ];

    // Render each meta key as its own row
    Object.keys(configGenParams.meta || {})
      .filter((key) => key !== 'federation_name')
      .forEach((key) => {
        let value: React.ReactNode = configGenParams.meta?.[key];
        if (!value) return;
        try {
          value = (
            <pre style={{ maxHeight: 200, overflow: 'auto', maxWidth: '100%' }}>
              {JSON.stringify(JSON.parse(value as string), null, 2)}
            </pre>
          );
        } catch {
          /* no-op, use value as string */
        }
        rows.push({
          label: t('connect-guardians.meta-field-key', { key }),
          value,
        });
      });

    content = (
      <Flex
        direction='column'
        gap={5}
        justify='start'
        align='start'
        width='100%'
      >
        <TableContainer width='100%'>
          <ChakraTable variant='simple'>
            <Tbody>
              {rows.map(({ label, value }) => (
                <Tr key={label}>
                  <Td fontWeight='semibold' verticalAlign='top'>
                    {label}
                  </Td>
                  <Td>{value}</Td>
                </Tr>
              ))}
            </Tbody>
          </ChakraTable>
        </TableContainer>
        <div>
          <Button onClick={handleApprove}>
            {t('connect-guardians.approve')}
          </Button>
        </div>
      </Flex>
    );
  }

  const peerTableColumns = useMemo(
    () =>
      [
        {
          key: 'name',
          heading: 'Name',
        },
        {
          key: 'status',
          heading: 'Status',
        },
      ] as const,
    []
  );

  const peerTableRows = useMemo(() => {
    let rows: TableRow<'name' | 'status'>[] = [];
    for (let i = 0; i < numPeers; i++) {
      const row = peers[i]
        ? {
            key: peers[i].cert,
            name: peers[i].name,
            status:
              peers[i].status === ServerStatus.ReadyForConfigGen ||
              ourCurrentId === i ? (
                <Tag colorScheme='green'>{t('connect-guardians.approved')}</Tag>
              ) : (
                <Tag colorScheme='orange'>{t('connect-guardians.pending')}</Tag>
              ),
          }
        : {
            key: i,
            name: `Guardian ${i + 1}`,
            status: (
              <Tag colorScheme='gray'>{t('connect-guardians.not-joined')}</Tag>
            ),
          };
      rows = [...rows, row];
    }
    return rows;
  }, [numPeers, ourCurrentId, peers, t]);

  return (
    <Flex
      direction='column'
      width='100%'
      justify='start'
      align='start'
      gap={10}
    >
      {content}
      {!!peerTableRows.length && (
        <Table
          title={t('connect-guardians.table-title')}
          description={t('connect-guardians.table-description')}
          columns={peerTableColumns}
          rows={peerTableRows}
        />
      )}
    </Flex>
  );
};
