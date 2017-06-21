#!/bin/sh
count=9
while true
do
  echo $count
  node delete_duplicate_data.js $count
  count=`expr $count + 1`
done
