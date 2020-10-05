const textArea = document.getElementById('text-input');
const solveBtn = document.getElementById('solve-button');
const clearBtn = document.getElementById('clear-button');
const sudokuInputs = document.getElementsByClassName('sudoku-input');
// import { puzzlesAndSolutions } from './puzzle-strings.js';

const setGrid = str => {
  const cells = document.querySelectorAll('.sudoku-input');
  const numbers = str.split('');
  
  return cells.forEach((cell, i) => {
    const currNum = numbers[i];

    validSudokuInput(currNum) && currNum !== '.' ? cell.value = currNum : cell.value = '';
  });
}

const setTextArea = () => {
  const cells = Array.from(document.querySelectorAll('.sudoku-input'));
  textArea.value = cells.reduce((str, {value}) => {value !== '' && validSudokuInput(value) ? str += value : str += '.'; return str}, '');
}

const validSudokuInput = str => {
  const possibleNum = parseInt(str);
  return (possibleNum >= 1 && possibleNum <= 9) && str;
}

const reference = () => {
  const combine = (a, b) => {
    const combos = [];
    for (let i in a) {
      for (let j in b) {
        combos.push(a[i] + b[j]);
      }
    }
    
    return combos;
  };

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const cols = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const rowSquare = [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']];
  const colSquare = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];
  
  const coords = combine(rows, cols);
  const rowUnits = rows.map(row => combine(row, cols));
  const colUnits = cols.map(col => combine(rows, col));
  const boxUnits = rowSquare.reduce((acc, curr) => {
    colSquare.forEach((col, j) => {
      acc.push(combine(curr, colSquare[j]))
    });
    
    return acc;
  }, []);
  
  const allUnits = rowUnits.concat(colUnits, boxUnits);
  const groups = {};
  /* 
    Generate an array of the three units (row, col, and box) that contain a single
    cell/coordinate. Each unit has a length of 9.
  */
  groups.units = coords.reduce((acc, currCell) => {
    acc[currCell] = allUnits.reduce((acc, currArr) => {
      if (currArr.includes(currCell)) {
        acc.push(currArr);
      }
      
      return acc;
    }, []);
    
    return acc;
  }, {});
  /* 
    Generate a list of peers for each cell/coordinate, which
    is a list of all cells in the three units *except* the cell
    itself. For ex., the peers of C2 are all the cells in its 
    three units except for C2. Each peer list has a length of 20.
  */
  groups.peers = coords.reduce((acc, currCell) => {
    const flattenedArr = groups.units[currCell].reduce((acc, currArr) => {
      currArr.forEach(el => acc.push(el));
      return acc;
    }, []);
    
    acc[currCell] = Array.from(new Set(flattenedArr)).filter(el => el !== currCell);
    
    return acc;
  }, {});
  
  
  return {
    coords,
    groups,
    allUnits
  }
}

// Make these available globally
const { coords, groups, allUnits } = reference();

const parsePuzzle = puzzle => {

      if (puzzle.length !== 81) {
        let errorMessage = 'Error: Expected puzzle to be 81 characters long.';

        document.getElementById('error-msg').innerText = errorMessage;

        return errorMessage;
      }

      let rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      let object = {};

      rows.forEach(
        (letter, index) => {
          for (let i = 1; i <= 9; i++)
            object[letter + i] = puzzle[i - 1 + index * 9];
        }
      );

      return object;
}

const solve = (puzzle = textArea.value) => {
  /*
    User clicks solve button
  */
  const digits = '123456789';
  let inputGrid = parsePuzzle(puzzle);
  // Bail out if the puzzle is not valid
  if (!inputGrid) return null;
  // Filter out cells with no value
  inputGrid = Object.keys(inputGrid).reduce((acc, key) => {
    const currVal = inputGrid[key];
    if (currVal !== '.') {
      acc[key] = currVal;
    }

    return acc;
  }, {});
  // 1-9 for each coordinate
  let outputGrid = coords.reduce((acc, coord) => {
    acc[coord] = digits;

    return acc;
  }, {});

  /* 
    Loop through the known positions on the input grid 
    and begin eliminating other possibilities for cells 
    without a value -- first pass of constraint propagation
  */
  Object.entries(inputGrid).forEach(([position, value]) => {
    outputGrid = confirmValue(outputGrid, position, value);
  });

  // If puzzle is complete after first pass, return it
  if (validatePuzzle(outputGrid)) {
    return outputGrid;
  }

  // Guess digits for incomplete puzzle
  return guessDigit(outputGrid);
}

const confirmValue = (grid, pos, val) => {

  const remainingValues = grid[pos].replace(val, '');
  
  remainingValues.split('').forEach(val => {
    grid = eliminate(grid, pos, val);
  });

  return grid;
}

const eliminate = (grid, pos, val) => {
  if (!grid) return false;

  if (!grid[pos].includes(val)) return grid; // Exit if we've already eliminated the value from the grid/cell

  grid[pos] = grid[pos].replace(val, ''); // Set cell value if known, otherwise remove possibility

  if (grid[pos].length === 0) { // If there are no possibilities we made a wrong guess somewhere
    return false; 
  } else if (grid[pos].length === 1) { // Remove known cell values from all peers recursively
    groups.peers[pos].forEach(peer => {
      grid = eliminate(grid, peer, grid[pos]);

      if (!grid) return false;
    });
  }

  const possibilities = groups.units[pos].reduce((acc, unit) => {
    return unit.map(coord => {
      if (grid[coord] && grid[coord].indexOf(val) > -1) return coord;
    }).filter(Boolean);
  }, []);

  if (possibilities.length === 0) { // We made a mistake somewhere if there are no possible values for a coordinate
    return false;
  } else if (possibilities.length === 1 && grid[possibilities[0]].length > 1) { // There is only one possible position, but the grid still lists multiple possibilities, confirm the value before removing it
    if (!confirmValue(grid, possibilities[0], val)) {
      return false;
    } 
  }
  
  return grid;
}

const guessDigit = grid => {
  /* 
    Guess a digit with the fewest number 
    of possibilities
  */
  if (!grid) return false;

  // End if there's a possible valid solution
  if (validatePuzzle(grid)) return grid;

  // Sort by cells with the least number of possibilities
  const possibilities = grid.filter(x => x.length > 1)
    .sort((a, b) => {
    return a[Object.keys(a)[0]].length - b[Object.keys(b)[0]].length;
  });

  const pos = Object.keys(possibilities[0])[0];

  for (let i in grid[pos]) {
    const val = grid[pos][i];
    const possibleSolution = guessDigit(confirmValue(Object.assign({}, grid), pos, val));

    if (possibleSolution) return possibleSolution;
  }
}

const validatePuzzle = puzzle => {
      let rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      let columns = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      let horizontalSum = 0;
      let verticalSum = 0;
      let matrixSums = [0, 0, 0, 0, 0, 0, 0, 0, 0];


      for (let i = 0; i < 9; i++) {

        for (let j = 0; j < 9; j++) {
          horizontalSum += parseInt(puzzle[rows[i] + columns[j]]);
          verticalSum += parseInt(puzzle[rows[j] + columns[i]]);

          if (j < 3) {
            matrixSums[i] += parseInt(puzzle[rows[i] + columns[j]]);
            if (i < 8) matrixSums[i] += parseInt(puzzle[rows[i + 1] + columns[j]]);
            if (i < 7) matrixSums[i] += parseInt(puzzle[rows[i + 2] + columns[j]]);
          }
          else if (j < 6) {
            matrixSums[i] += parseInt(puzzle[rows[i] + columns[j]]);
            if (i < 8) matrixSums[i] += parseInt(puzzle[rows[i + 1] + columns[j]]);
            if (i < 7) matrixSums[i] += parseInt(puzzle[rows[i + 2] + columns[j]]);
          }
          else if (j < 9) {
            matrixSums[i] += parseInt(puzzle[rows[i] + columns[j]]);
            if (i < 8) matrixSums[i] += parseInt(puzzle[rows[i + 1] + columns[j]]);
            if (i < 7) matrixSums[i] += parseInt(puzzle[rows[i + 2] + columns[j]]);
          }
        }

        if (horizontalSum !== 45 || verticalSum !== 45) return false;

        horizontalSum = 0;
        verticalSum = 0;
      }

      if (!matrixSums.every(sum => sum % 45 === 0)) return false;


      return true;
}

const showSolution = obj => {
  // Only handle cases where the puzzle is valid
  if (obj) {
    const solutionStr = Object.values(obj).join().replace(/\,/g, '');
    setGrid(solutionStr), setTextArea();
  }
}

const clearInput = () => {
  /*
    User clicks clear button
  */
  const textArea = document.getElementById('text-input');
  
  return textArea.value = '', setGrid('');
}

// LEAVE THIS IN BOILERPLATE! (Except for the `setGrid` line)
document.addEventListener('DOMContentLoaded', () => {
  // Set text area with a simple puzzle
  textArea.value = '..9..5.1.85.4....2432......1...69.83.9.....6.62.71...9......1945....4.37.4.3..6..';
  
  setGrid(textArea.value);

  Array.from(sudokuInputs).forEach(input => input.addEventListener('input', setTextArea));
  solveBtn.addEventListener('click', () => { showSolution(solve()) }, false);
  clearBtn.addEventListener('click', clearInput, false);
});

/* 
  Export your functions for testing in Node.
  Note: The `try` block is to prevent errors on
  the client side
*/
try {
  module.exports = {
    validSudokuInput,
    validatePuzzle,
    parsePuzzle,
    solve,
    setTextArea,
    setGrid,
    clearInput,
    showSolution
  }
} catch (e) {}


/* 
My own false solution :)

solve(puzzleText) {
  let puzzle = this.parsePuzzle(puzzleText);
  let possible = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const squares = [
    ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'],
    ['A4', 'A5', 'A6', 'B4', 'B5', 'B6', 'C4', 'C5', 'C6'],
    ['A7', 'A8', 'A9', 'B7', 'B8', 'B9', 'C7', 'C8', 'C9'],
    ['D1', 'D2', 'D3', 'E1', 'E2', 'E3', 'F1', 'F2', 'F3'],
    ['D4', 'D5', 'D6', 'E4', 'E5', 'E6', 'F4', 'F5', 'F6'],
    ['D7', 'D8', 'D9', 'E7', 'E8', 'E9', 'F7', 'F8', 'F9'],
    ['G1', 'G2', 'G3', 'H1', 'H2', 'H3', 'I1', 'I2', 'I3'],
    ['G4', 'G5', 'G6', 'H4', 'H5', 'H6', 'I4', 'I5', 'I6'],
    ['G7', 'G8', 'G9', 'H7', 'H8', 'H9', 'I7', 'I8', 'I9']
  ];
  const rows = [
    ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'],
    ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9'],
    ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'],
    ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9'],
    ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'],
    ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'],
    ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9'],
    ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9'],
    ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9']
  ];
  const columns = [
    ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1'],
    ['A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2', 'H2', 'I2'],
    ['A3', 'B3', 'C3', 'D3', 'E3', 'F3', 'G3', 'H3', 'I3'],
    ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4'],
    ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'I5'],
    ['A6', 'B6', 'C6', 'D6', 'E6', 'F6', 'G6', 'H6', 'I6'],
    ['A7', 'B7', 'C7', 'D7', 'E7', 'F7', 'G7', 'H7', 'I7'],
    ['A8', 'B8', 'C8', 'D8', 'E8', 'F8', 'G8', 'H8', 'I8'],
    ['A9', 'B9', 'C9', 'D9', 'E9', 'F9', 'G9', 'H9', 'I9']
  ];
  
  const check = (rowIndex, columnIndex) => {

    if(puzzle[rows[rowIndex][columnIndex]] !== '.') return;

    rows.forEach(
      (row) => {
        if (row.includes(rows[rowIndex][columnIndex])) {
          row.forEach(cell => {
            if (
              possible.indexOf(puzzle[cell]) !== -1
            ) possible.splice(possible.indexOf(puzzle[cell]), 1);
          });
        }
      }
    );

    columns.forEach(
      (column) => {
        if (column.includes(rows[rowIndex][columnIndex])) {
          column.forEach(cell => {
            if (
              possible.indexOf(puzzle[cell]) !== -1
            ) possible.splice(possible.indexOf(puzzle[cell]), 1);
          });
        }
      }
    );
    
    squares.forEach(
      (square) => {
        if (square.includes(rows[rowIndex][columnIndex])) {
          square.forEach(cell => {
            if (
              possible.indexOf(puzzle[cell]) !== -1
            ) possible.splice(possible.indexOf(puzzle[cell]), 1);
          });
        }
      }
    );

    if (possible.length > 0)
      puzzle[rows[rowIndex][columnIndex]] = possible[0];

      possible = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  }

  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      check(i, j);
    }
  }

  console.log(puzzle);

}

*/