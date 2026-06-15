import { useState } from 'react'

import reactLogo from '@/assets/react.svg'

import wxtLogo from '/wxt.svg'

import './App.css'

export function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://wxt.dev" rel="noopener" target="_blank">
          <img
            alt="WXT logo"
            className="logo"
            height={72}
            src={wxtLogo}
            width={72}
          />
        </a>
        <a href="https://react.dev" rel="noopener" target="_blank">
          <img
            alt="React logo"
            className="logo react"
            height={32}
            src={reactLogo}
            width={36}
          />
        </a>
      </div>
      <h1>WXT + React</h1>
      <div className="card">
        <button onClick={() => setCount(count => count + 1)} type="button">
          count is {count}
        </button>
        <p>
          Edit <code>entrypoints/popup/app.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the WXT and React logos to learn more
      </p>
    </>
  )
}
