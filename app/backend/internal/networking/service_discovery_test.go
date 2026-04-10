package networking

import "testing"

func TestLoadBalancerRoundRobinSelection(t *testing.T) {
	lb := NewLoadBalancer(StrategyRoundRobin)
	instances := []*ServiceInstance{
		{ID: "a"},
		{ID: "b"},
	}

	first := lb.SelectInstance(instances, "")
	second := lb.SelectInstance(instances, "")
	third := lb.SelectInstance(instances, "")

	if first == nil || second == nil || third == nil {
		t.Fatalf("expected non-nil selections")
	}
	if first.ID != "a" || second.ID != "b" || third.ID != "a" {
		t.Fatalf("unexpected round-robin order: %s, %s, %s", first.ID, second.ID, third.ID)
	}
}

func TestLoadBalancerLeastConnectionsSelection(t *testing.T) {
	lb := NewLoadBalancer(StrategyLeastConnections)
	instances := []*ServiceInstance{
		{ID: "busy", Metadata: map[string]string{"active_connections": "42"}},
		{ID: "idle", Metadata: map[string]string{"active_connections": "1"}},
	}

	selected := lb.SelectInstance(instances, "")
	if selected == nil {
		t.Fatalf("expected non-nil instance")
	}
	if selected.ID != "idle" {
		t.Fatalf("expected idle instance, got %s", selected.ID)
	}
}
