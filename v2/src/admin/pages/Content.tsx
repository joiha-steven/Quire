// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { ContentDashboard } from '@/admin/components/ContentDashboard'
import type { ComponentProps } from 'react'

type Props = ComponentProps<typeof ContentDashboard>

export default function Content() {
  const state = useView<Props>('content')
  return <View state={state}>{(data) => <ContentDashboard {...data} />}</View>
}
