import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import ReactPolling from 'react-polling'

import client from 'part:@sanity/base/client'

import { Badge, Box, Button, Dialog, Grid, Text, Tooltip } from '@sanity/ui'
import AnchorButton from 'part:@sanity/components/buttons/anchor'

import styles from './deploy-item.css'
import DeployLog from './deploy-log'
import Status, { titleCase } from './status'

const deployItem = ({
  name,
  url,
  id,
  vercelProject,
  vercelToken,
  vercelTeam,
  toggleSnackbar
}) => {
  const [isUpdating, setUpdating] = useState(vercelToken && vercelProject)
  const [isDeploying, setDeploying] = useState(false)
  const [status, setStatus] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [project, setProject] = useState(false)
  const [isDeployLogOpen, setIsDeployLogOpen] = useState(false)
  const [offset, setOffset] = useState(5)

  const statusRef = useRef()
  statusRef.current = false

  useEffect(() => {
    let isSubscribed = true
    if (vercelToken && vercelProject) {
      // get project ID from project name
      getProject(vercelProject)
        .then(res => {
          if (res.data.id) {
            setProject(res.data.id)
          }
        })
        .catch(err => {
          console.log(err)
          const errorMessage = err.response?.data?.error?.message

          setStatus('ERROR')
          statusRef.current = 'ERROR'

          if (errorMessage) {
            setErrorMsg(errorMessage)
          }

          setUpdating(false)
        })

      // get latest project deployment
      if (project) {
        getLatestDeployment().then(res => {
          if (isSubscribed) {
            const deployment = res.data.deployments[0]

            setUpdating(false)
            setStatus(deployment.state)

            if (status !== 'READY' || status !== 'ERROR') {
              setDeploying(true)
            }
          }
        })
      }
    }

    return () => (isSubscribed = false)
  }, [project])

  useEffect(() => {
    let isSubscribed = true
    if (
      (status === 'READY' || status === 'ERROR') &&
      isSubscribed &&
      vercelToken &&
      vercelProject
    ) {
      setDeploying(false)
    }

    return () => (isSubscribed = false)
  }, [status])

  const getLatestDeployment = async () => {
    const options = {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${vercelToken}`
      },
      url: `https://api.vercel.com/v5/now/deployments?projectId=${project}&limit=1${
        vercelTeam?.id ? `&teamId=${vercelTeam?.id}` : ''
      }`
    }

    return axios(options)
  }

  const getProject = id => {
    const options = {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${vercelToken}`
      },
      url: `https://api.vercel.com/v1/projects/${id}${
        vercelTeam?.id ? `?teamId=${vercelTeam?.id}` : ''
      }`
    }

    return axios(options)
  }

  const onDeploy = (name, url) => {
    setDeploying(true)
    setStatus('INITIATED')

    toggleSnackbar(false)

    global
      .fetch(url, {
        method: 'POST'
      })
      .then(res => {
        toggleSnackbar(
          true,
          'success',
          'Success!',
          `Triggered Deployment: ${name}`
        )
      })
      .catch(err => {
        setDeploying(false)
        toggleSnackbar(true, 'error', 'Deploy Failed', `${err}`)
        console.log(err)
      })
  }

  const onRemove = (name, id) => {
    setUpdating(true)
    client.delete(id).then(res => {
      setUpdating(false)
      toggleSnackbar(true, 'success', 'Success!', `Deleted Deployment: ${name}`)
    })
  }

  return (
    <>
      <div className={styles.hook}>
        <div className={styles.hookDetails}>
          <h4 className={styles.hookTitle}>
            {`${name} `}
            <Badge>{vercelProject}</Badge>

            {vercelTeam?.id && (
              <>
                {' '}
                <Badge tone="primary">{vercelTeam?.name}</Badge>
              </>
            )}
          </h4>
          <p className={styles.hookURL}>{url}</p>
        </div>
        <div className={styles.hookActions}>
          {vercelToken && vercelProject && (
            <div className={styles.hookStatus}>
              {isDeploying ? (
                <ReactPolling
                  url="custom"
                  method="GET"
                  interval={3000}
                  retryCount={5}
                  onSuccess={res => {
                    const deployment = res.data.deployments[0]
                    // catch if initial deployment hasn't updated yet

                    if (
                      statusRef.current === false &&
                      deployment.state === 'READY'
                    ) {
                      return true
                    }

                    setStatus(deployment.state)
                    statusRef.current = deployment.state

                    return true
                  }}
                  onFailure={err => console.log(err)}
                  promise={getLatestDeployment}
                  render={({ isPolling }) => {
                    if (isPolling) {
                      return (
                        <div>
                          {status ? (
                            <Status status={status}>{titleCase(status)}</Status>
                          ) : (
                            <Status status="LOADING">Loading</Status>
                          )}
                        </div>
                      )
                    } else {
                      return <Status status="INACTIVE">Status Inactive</Status>
                    }
                  }}
                />
              ) : (
                <>
                  {status ? (
                    <Status status={status}>
                      {errorMsg ? (
                        <>
                          {titleCase(status)}
                          <Tooltip
                            content={
                              <Box padding={2}>
                                <Text muted size={1}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      textAlign: 'center'
                                    }}
                                  >
                                    {errorMsg}
                                  </span>
                                </Text>
                              </Box>
                            }
                            placement="top"
                          >
                            <span className={styles.hookStatusError}>
                              <Badge mode="outline" tone="critical">
                                ?
                              </Badge>
                            </span>
                          </Tooltip>
                        </>
                      ) : (
                        <>{titleCase(status)}</>
                      )}
                    </Status>
                  ) : (
                    <Status status="LOADING">Loading</Status>
                  )}
                </>
              )}
            </div>
          )}
          <Grid columns={[1, 3]} gap={[2]}>
            <Button
              type="button"
              tone="positive"
              disabled={isDeploying || isUpdating}
              loading={isDeploying}
              onClick={() => onDeploy(name, url)}
              text="Deploy"
            />{' '}
            <Button
              type="button"
              tone="critical"
              disabled={isDeploying || isUpdating}
              onClick={() => onRemove(name, id)}
              text="Remove"
            />
            <Button
              type="button"
              tone="neutral"
              disabled={!project}
              onClick={() => setIsDeployLogOpen(true)}
              text="Logs"
            />
          </Grid>
        </div>
      </div>

      {isDeployLogOpen && (
        <Dialog
          header={`Recent deployments for ${vercelProject}`}
          footer={
            <AnchorButton
              onClick={() => setOffset(offset + 5)}
              bleed
              color="primary"
              kind="simple"
            >
              Load more
            </AnchorButton>
          }
          onClickOutside={() => setIsDeployLogOpen(false)}
          onClose={() => setIsDeployLogOpen(false)}
          width={null}
          zOffset={1000}
        >
          <Box padding={4}>
            <DeployLog
              offset={offset}
              vercelProject={project}
              vercelToken={vercelToken}
              vercelTeam={vercelTeam}
            />
          </Box>
        </Dialog>
      )}
    </>
  )
}

export default deployItem
