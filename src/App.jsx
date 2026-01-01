import React, { useState, useContext } from 'react';
import {ThemeContext} from './ThemeContext';

export default function App() {
    const { displayCurrency, setDisplayCurrency } = useContext(ThemeContext);

    return (
          <div>
                <h1>Dump Tires</h1>h1>
                <p>displayCurrency: {displayCurrency}</p>p>
          </div>div>
        );
}</div>
