Scenario 1:
The user opens the application.
The system shows him the game menu.
It has two options, Resume Game and Auction House.
The user access the auction house.

The system shows him his Monero credits and his Gruber credits.
The system also shows him the latest contest results.
The contest results are shown like this:
1. Xyyz56 XMR 30u GRB 0
2. User567 XMR 20u GRB 0
3. User890 XMR 20u GRB 0
4. User901 XMR 20u GRB 0
5. User172 XMR 10u GRB 0
6. User072 XMR 0 GRB 1234
7. ...etc

And there can be as many as 5 results displayed.
The system also shows him the ongoing penny auctions.
Each auction has the principal amount in the top,
wiht the winning bid just below it, and the second
and third bids (the previous winning bids)
below that and in a smaller font.
Just beside the principal amount (or in other location, we'll see)
there is the remaining time, counting down.

The user can see all the open auctions, if he likes.
The system also presents him the option to enter a ranking contest.

The user selects that option. The system presents him the
different categories of ranking contests. Each category represents
the entrance fee for their contests.
There are cheaper, medium, and expensive contests.
The system displays and indicator if he doesn't have enough
Monero credits to enter in that category.

Then the user selects a category. The system then asks him
how much Gruber$ he would like to participate with. The system
indicates how much he has left.
The user enters the desired amount and clicks Enter.

The system collects the entrances for a category, and if there are
10 entrances, he runs the contest and displays the results for each
participant. If there is no immediate contest, the system tells
the participant that he is in a queue and must wait for enough participants.
The user can only wait in the meantime.

When the contest ends the system shows the resulting ranking to the user
and in te bottom the system shows the new balances for Monero and Grubers,
side by side.

The user clicks Ok and is led to the main page of the auction house.

The user then scrolls to the ongoing auctions.
The auctions can be divided by categories also, where each category is the cost
of the bid.
He sees one that he likes, and then enters the desired amount in Grubers of the bid
and clicks Send. The bid fee is deduced from his Monero credits, a cut is taken by the platform,
and the remainder of the fee is added to the auction principal. If he is the winning bid for now
he's name is displayed as such. If, before the system could process his bid, someone else outbid him,
then the system returns the entire fee to the user and uncommits the gruber ammount he bidded with.


The validation of coins is done as such:

The client sends the block he wants validated.

The server divides it in blocks of 1000 grubers

For each block the server takes some sample coins and runs the coin val in them

If any of the sample coins is validated, then that 1k block is validated too.

The system does this for all 1k blocks and returns to the client the amount
that was validated.

The coin validation is done as follows:

There is a difficulty index that goes from 1 to 32.
Each coin has a 32 character identifier.
The system generates random characters, the length of this array is the difficulty index.

Then, for each element of the array it checks if the element is present in the identifier
of the coin. If it's present, then that position is removed from the identifier, and the cking
proceeds to the next element of the verification array. If all lements of the array
matched in the coin id, then the coin is validated. If not, the coin is not validated.

The difficulty index can be increased or decreased based on some factors.
They are:

1) Time between validation requests. The more time, the easier it gets.
2) The amount that is to be validated. The more coins, the less easier it gets.
3) Some coins can have special markers in their id. These markers are a sequence
of characters that indicates some special achievement in the game.
For example, there may be NPC accounts that only cater to special transactions which represent
great achievements. If these markers are identified in some sample coin, the difficulty index
is lowered by half.

trading? Or game?
trading can be done easier,
but game can also be done easier
trading may attract more people?
Trading will turn off people if there aren't a lot of indicator to use

Game will turn off somewhat serious people.
game can be sold for people who like playing games,
and trading can be sold for people who like trading and
working in general.
Easiest to approach, gamers or traders?
Effort for trading, and effort for gaming
Consistency of platform
if it's ascii games, is there expectancy of ascii platform?
Maybe the auction house has a different style?
to differentiate between the games and the studio in general.
that's what the trading sim is, a game.
Maybe it should have the same color palette we'll use for
the other games. Same fonts, too, perhaps?

No, it's better to have wildly different styles, but have
games in each category that have the same style.
Example: Business sims, that includes the trading sim, all
have the same business-like style, and can be found in the
same webpage which also has the same style.
The asciiverse games can be found in a different webpage
and all have the same styles too.
The studio webpage has yet a third different style, which is
the same as the auction house.
we can work on trading sim and games at the same time.
but for now we do the sim?


Tasks:
1. Register:
    a. The user open the page.
    b. The system presents him a button to register.
    c. The system gives the user the password he'll use from now on.
    d. User clicks Ok.
    e. The system redirects the user to the game page.

2. Simpler Game page
    a. The system display a guess the number game.
    b. The user tries to guess the number.
    c. If the user gets the number correct, he earns a 100 Grubers.
    d. Sync button.
    e. Sync mechanis, show modal with loading and then validated balance.
    f. Link to auction house.

4. Auction house
    a. Display the 5 latest ranking results, one per category?
    b. Display the biggest 5 ongoing penny auctions.
    c. Button to participate in a ranking contest.
    d. Modal with input to enter amount he wishes to compete with.

5. Admin actions
    a. Implement admin password.
    b. Page with options: Add monero credits, see sync stats, block user, remove user.

3. Game page.
    a. The system generates the first year of data.
    b. The system shows the user the daily chart for that year for the first instrument.
    c. The system shows a panel with the closing half-second prices of random 30 instruments.
    d. The system shows the user a search input for instruments.
    e. Inside the chart the system shows a buy button.
    f. The system shows a panel with the current portfolio of the user.
    g. The game is running, but there is a button to pause it.
    h. There is a button to speed up the game.
    i. When the game is paused, there is a button to step a given unit of time.
    j. There is a button to slow down the game.
    k. In the portfolio panel, when the user clicks a line, the system shows him
    the option to sell that particular item.
    l. Stop-losses
    m. Take-profits
    n. Limit orders.
    o. Limit orders from chart.
    p. Modify stop loss.
    q. Modify stop-loss and take-profit from chart.
    r. Button to sync with server.
    s. Sync implementation.
    t. Display Gruber$ balance.
    u. Display validated Gruber$ balance.