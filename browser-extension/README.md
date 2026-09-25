# Lucky Jet Read-Only Safari Collector

This folder is a standard WebExtension source package intended for Safari Web Extension packaging.

## Purpose

The extension observes only browser-visible Lucky Jet WebSocket messages on the allowed Lucky Jet hosts and forwards sanitized coefficient candidates to the Render diagnostic endpoint.

It does not send SSID, cookies, authorization headers, passwords, bets, deposits, withdrawals, or account-control commands.

## Packaging

The complete contents of this folder can be uploaded to Apple's Safari Web Extension Packager in App Store Connect.

Apple supports packaging Safari Web Extensions from App Store Connect without a Mac or Xcode.

## Runtime

After installation and permission is granted in Safari, open the normal Lucky Jet page. The collector starts automatically at document start and watches the allowed game WebSocket paths.

A candidate is reported only when a received JSON frame contains an allowed coefficient-like field.

The server must still verify whether the field represents a future coefficient before exposing it as a signal.
