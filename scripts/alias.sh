#!/bin/bash

alias t0='tail -F ~/.forever/main.log'
alias t00='tail -F ~/.forever/firemain.log'
alias t1='tail -F ~/.forever/kickui.log'
alias t2='tail -F ~/.forever/monitor.log'
alias t3='tail -F ~/.forever/api.log'
alias fr0='forever restart 0'
alias fr1='forever restart 1'
alias fr2='forever restart 2'
alias fr3='forever restart 3'
alias sr0='sudo systemctl restart firemain'
alias sr1='sudo systemctl restart firekick'
alias sr2='sudo systemctl restart firemon'
alias sr3='sudo systemctl restart fireapi'