'use client'

export default function PrintBtn({ label = 'Print / PDF', page = false }) {
  function go(e) {
    const panel = page ? null : e.currentTarget.closest('.panel')
    if (panel) { document.body.classList.add('printing-one'); panel.classList.add('print-target') }
    const done = () => {
      document.body.classList.remove('printing-one'); panel?.classList.remove('print-target')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
  }
  return <button className="printbtn no-print" onClick={go}>{label}</button>
}
