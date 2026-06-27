import { QNX_HANDHELDS_REPO } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'

const QNX_HANDHELDS_URL = `https://github.com/${QNX_HANDHELDS_REPO}`

function openExternal(url: string) {
  window.berrybridge.shell.openExternal(url)
}

export function QnxPage() {
  return (
    <>
      <PageHeader
        title="QNX"
        subtitle="The real-time OS behind BlackBerry 10 — still running, still evolving."
      />

      <Panel title="QNX & BlackBerry 10" className="qnx-panel">
        <p className="panel-desc">
          BlackBerry 10 ran on <strong>QNX Neutrino</strong> — a microkernel RTOS built for
          reliability, low latency, and hard real-time work. That is why BB10 felt different: genuine
          multitasking, a coherent process model, and a UNIX-like environment beneath the UI.
        </p>
        <p className="panel-desc">
          When the consumer phone line ended, QNX did not. It is maintained, shipped, and deployed in
          production systems every day.
        </p>
      </Panel>

      <Panel title="Automotive, robotics &amp; beyond" className="qnx-panel">
        <p className="panel-desc">
          Through QNX, BlackBerry has become a major presence in <strong>automotive</strong> —
          infotainment, ADAS, digital cockpits, and safety-critical software. The same RTOS foundation
          applies naturally to <strong>robotics</strong>, industrial control, medical devices, and
          edge systems where Linux is not always the right fit.
        </p>
        <p className="panel-desc">
          That shift is strategic, not sentimental: QNX belongs where deterministic behavior and
          certified stacks matter.
        </p>
      </Panel>

      <Panel title="The future: QNX on new hardware" className="qnx-panel qnx-panel-accent">
        <p className="panel-desc">
          The next chapter is putting QNX on new hardware — and I hope it has a keyboard :)
        </p>
        <p className="panel-desc">
          QNX is built for that kind of device: deterministic, low-latency, real-time software on
          silicon you can actually hold. It is the same RTOS behind BlackBerry 10 — now proven in
          automotive and embedded systems at scale — and a natural fit for boards, field tools, and
          handhelds again.
        </p>
      </Panel>

      <Panel title="QNX-Handhelds — first step" className="qnx-panel qnx-panel-cta">
        <p className="panel-desc">
          <strong>QNX-Handhelds</strong> is the first open step toward that future: a community repo
          for builders who want QNX back on hardware you can hold — a real pocket computer with a
          real operating system.
        </p>
        <p className="qnx-tagline">#moving forward with QNX</p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => openExternal(QNX_HANDHELDS_URL)}>
            View QNX-Handhelds on GitHub →
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openExternal('https://www.patreon.com/c/Sw7ft')}
          >
            Support the initiative
          </button>
        </div>
        <p className="field-hint" style={{ marginTop: 12 }}>
          Interested in hardware bring-up, images, or reference designs? Start at{' '}
          <button type="button" className="bb-home-link" onClick={() => openExternal(QNX_HANDHELDS_URL)}>
            {QNX_HANDHELDS_REPO}
          </button>
          .
        </p>
      </Panel>
    </>
  )
}
