const mysql = require('mysql2/promise');
import {v4 as uuidv4} from 'uuid';
app.post('/transfer', (req, res) => {
    // Input validation for invalid amount
    if (!req.amount || req.amount <= 0) {
    return new Error ('Amount to be transfered should be greater than zero.');
}
let fromAccount  = req.from;
let amountToBeTransferred = req.amount;
let toAccount = req.to;

async function transferMoney(fromAccount, toAccount, amount) {
    // Connection establishing with mysql , we can pass db config here
    const connection = await mysql.createConnection(/*dbConfigs*/);
    // Begin Transaction
    await connection.beginTransaction();
    try {
        let accounts = [fromAccount, toAccount];
        let currBalanceFromAccount;
        let currBalanceToAccount;
        // Fetching Balance for both the from and to accounts by taking lock
        let currBalRows = await connection.execute('SELECT * from balances where account_nr IN (?, ?) FOR UPDATE', accounts);
        for (currBalRow of currBalRows) {
            if (currBalRow.account_nr == fromAccount) {
                currBalanceFromAccount = currBalRow.balance;
            }
            if (currBalRow.account_nr == toAccount) {
                currBalanceToAccount = currBalRow.balance;
            }
        }
        // Throw error in case there are no sufficient funds in source account.
        if (currBalanceFromAccount < amount) {
            throw new Error('Insufficient Balance');
        }
        // Throw error in case toAccount does not exist.
        if (!currBalanceToAccount) {
            throw new Error('Destination account does not exist');
        }
        let updatedFromBalance = currBalanceFromAccount - amount;
        let updatedToBalance = currBalanceToAccount + amount;
        // Generating uuid for txnid reference
        txnId = uuidv4();
        txnIdTo = uuidv4();
        // Inserting rows in transactions table. Debit entry with negative amount and credit entry with positive amount
        await connection.execute('INSERT into transactions (reference, amount, account_nr) VALUES (?, ?, ?)', txnId, -1 * amount, fromAccount);
        await connection.execute('INSERT into transactions (reference, amount, account_nr) VALUES (?, ?, ?)', txnIdTo, amount, toAccount);
        await connection.execute('UPDATE balances set balance = balance - ' + amount + ' where account_nr = ' + fromAccount + '');
        await connection.execute('UPDATE balances set balance = balance + ' + amount + ' where account_nr = ' + toAccount + '');
        await connection.commit();
        let response = {
            id: txnId,
            transfered: amount,
            from: {
                id: fromAccount,
                balance: updatedFromBalance
            },
            to: {
                id: toAccount,
                balance: updatedToBalance
            }
        }
        // returning the response in required format.
        return res.json(response);
    } catch (err) {
        console.error(`Error occurred while transferring money: ${err.message}`, err);
        connection.rollback();
        return new Error('Error transferring money');
    }
}

transferMoney(fromAccount, toAccount, amountToBeTransferred);
});
