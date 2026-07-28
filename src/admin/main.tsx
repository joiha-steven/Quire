// The admin bundle's entry point.
//
// One mount, no hydration: the server sends an empty shell, because there is nothing about
// an owner-only tool that benefits from being server-rendered and a second rendering path
// is a second set of bugs.

import { createRoot } from 'react-dom/client'
import { App } from '@/admin/App'

const root = document.getElementById('admin')
if (!root) throw new Error('the admin mount point is missing from the shell HTML')
createRoot(root).render(<App />)
